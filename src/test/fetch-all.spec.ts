import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchAll } from "../fetch-all";
import { HttpClient } from "../http";
import { errorResponse, installFetchMock, jsonResponse, type FetchMock } from "./helpers";

interface Item {
	id: number;
}

function page(items: number[], page: number, pageSize: number, total: number) {
	return jsonResponse({
		data: items.map((id) => ({ id })),
		meta: { pagination: { page, pageSize, pageCount: Math.ceil(total / pageSize), total } },
	});
}

function offset(items: number[], start: number, limit: number, total: number) {
	return jsonResponse({ data: items.map((id) => ({ id })), meta: { pagination: { start, limit, total } } });
}

function urlsOf(mock: FetchMock): string[] {
	return mock.mock.calls.map(([input]) => decodeURIComponent(String(input)));
}

describe("fetchAll", () => {
	let fetchMock: FetchMock;
	let http: HttpClient;
	const base = { path: "articles", defaultLocale: "en", concurrency: 2 };

	beforeEach(() => {
		fetchMock = installFetchMock();
		http = new HttpClient({ baseURL: "http://h" });
	});

	afterEach(() => vi.restoreAllMocks());

	it("returns a single page unchanged when pageCount is 1", async () => {
		fetchMock.mockResolvedValueOnce(page([1, 2], 1, 25, 2));
		const [err, data, meta] = await fetchAll<Item>({ http, ...base });
		expect(err).toBeNull();
		expect(data).toEqual([{ id: 1 }, { id: 2 }]);
		expect(meta).toEqual({ pagination: { page: 1, pageSize: 25, pageCount: 1, total: 2 } });
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("fetches remaining pages and merges in order", async () => {
		fetchMock
			.mockResolvedValueOnce(page([1, 2], 1, 2, 5))
			.mockResolvedValueOnce(page([3, 4], 2, 2, 5))
			.mockResolvedValueOnce(page([5], 3, 2, 5));
		const [err, data, meta] = await fetchAll<Item>({
			http,
			...base,
			params: { pagination: { pageSize: 2 }, sort: ["id:asc"] },
		});
		expect(err).toBeNull();
		expect(data?.map((i) => i.id)).toEqual([1, 2, 3, 4, 5]);
		expect(meta).toEqual({ pagination: { page: 1, pageSize: 5, pageCount: 1, total: 5 } });
		const urls = urlsOf(fetchMock);
		expect(urls[1]).toContain("pagination[page]=2");
		expect(urls[1]).toContain("pagination[pageSize]=2");
		expect(urls[1]).toContain("sort[0]=id:asc");
		expect(urls[2]).toContain("pagination[page]=3");
	});

	it("starts from the requested page", async () => {
		fetchMock.mockResolvedValueOnce(page([3, 4], 2, 2, 6)).mockResolvedValueOnce(page([5, 6], 3, 2, 6));
		const [, data] = await fetchAll<Item>({ http, ...base, params: { pagination: { page: 2, pageSize: 2 } } });
		expect(data?.map((i) => i.id)).toEqual([3, 4, 5, 6]);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("uses offset mode when start or limit is given", async () => {
		fetchMock
			.mockResolvedValueOnce(offset([1, 2], 0, 2, 5))
			.mockResolvedValueOnce(offset([3, 4], 2, 2, 5))
			.mockResolvedValueOnce(offset([5], 4, 2, 5));
		const [err, data, meta] = await fetchAll<Item>({ http, ...base, params: { pagination: { limit: 2 } } });
		expect(err).toBeNull();
		expect(data?.map((i) => i.id)).toEqual([1, 2, 3, 4, 5]);
		expect(meta).toEqual({ pagination: { start: 0, limit: 2, total: 5 } });
		const urls = urlsOf(fetchMock);
		expect(urls[1]).toContain("pagination[start]=2");
		expect(urls[1]).toContain("pagination[limit]=2");
		expect(urls[2]).toContain("pagination[start]=4");
	});

	it("honours a non-zero start in offset mode", async () => {
		fetchMock.mockResolvedValueOnce(offset([4, 5], 3, 2, 6)).mockResolvedValueOnce(offset([6], 5, 2, 6));
		const [, data, meta] = await fetchAll<Item>({ http, ...base, params: { pagination: { start: 3, limit: 2 } } });
		expect(data?.map((i) => i.id)).toEqual([4, 5, 6]);
		expect(meta).toEqual({ pagination: { start: 3, limit: 2, total: 6 } });
	});

	it("passes locale on every page", async () => {
		fetchMock.mockResolvedValueOnce(page([1], 1, 1, 2)).mockResolvedValueOnce(page([2], 2, 1, 2));
		await fetchAll<Item>({ http, ...base, locale: "fr", params: { pagination: { pageSize: 1 } } });
		for (const url of urlsOf(fetchMock)) expect(url).toContain("locale=fr");
	});

	it("returns data when the response has no pagination meta", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({ data: [{ id: 9 }] }));
		const [err, data, meta] = await fetchAll<Item>({ http, ...base });
		expect(err).toBeNull();
		expect(data).toEqual([{ id: 9 }]);
		expect(meta).toBeNull();
	});

	it("returns the first request error", async () => {
		fetchMock.mockResolvedValueOnce(errorResponse(403, "ForbiddenError", "Forbidden"));
		const [err, data] = await fetchAll<Item>({ http, ...base });
		expect(err?.name).toBe("ForbiddenError");
		expect(data).toBeNull();
	});

	it("returns a later page error", async () => {
		fetchMock
			.mockResolvedValueOnce(page([1], 1, 1, 3))
			.mockResolvedValueOnce(page([2], 2, 1, 3))
			.mockResolvedValueOnce(errorResponse(500, "InternalServerError", "boom"));
		const [err, data] = await fetchAll<Item>({ http, ...base, params: { pagination: { pageSize: 1 } } });
		expect(err?.status).toBe(500);
		expect(data).toBeNull();
	});
});
