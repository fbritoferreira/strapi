import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import { Strapi } from "../index";
import type { StrapiDocument } from "../types";
import { installFetchMock, jsonResponse, type FetchMock } from "./helpers";

interface Article extends StrapiDocument {
	readonly __populatable?: "author";
	title: string;
	author?: { name: string } | null;
}

const page = (ids: number[], pageNumber: number, pageSize: number, total: number) =>
	jsonResponse({
		data: ids.map((id) => ({ id, documentId: `d${id}`, title: `A${id}` })),
		meta: { pagination: { page: pageNumber, pageSize, pageCount: Math.ceil(total / pageSize), total } },
	});

describe("pages()", () => {
	let fetchMock: FetchMock;
	const strapi = new Strapi({ baseURL: "http://h", defaultLocale: "en" });
	const articles = strapi.collection<Article>("articles");

	beforeEach(() => {
		fetchMock = installFetchMock();
	});
	afterEach(() => vi.restoreAllMocks());

	it("yields one page at a time until they run out", async () => {
		fetchMock
			.mockResolvedValueOnce(page([1, 2], 1, 2, 5))
			.mockResolvedValueOnce(page([3, 4], 2, 2, 5))
			.mockResolvedValueOnce(page([5], 3, 2, 5));

		const seen: number[][] = [];
		for await (const [err, batch] of articles.pages({ params: { pagination: { pageSize: 2 } } })) {
			if (err) throw new Error(err.message);
			seen.push(batch.map((a) => a.id));
		}
		expect(seen).toEqual([[1, 2], [3, 4], [5]]);
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it("requests the next page only when the consumer asks for it", async () => {
		fetchMock.mockResolvedValueOnce(page([1], 1, 1, 100)).mockResolvedValueOnce(page([2], 2, 1, 100));

		const iterator = articles.pages({ params: { pagination: { pageSize: 1 } } })[Symbol.asyncIterator]();
		await iterator.next();
		expect(fetchMock).toHaveBeenCalledTimes(1);
		await iterator.next();
		expect(fetchMock).toHaveBeenCalledTimes(2);
		await iterator.return?.();
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("narrows each page the way findMany does", async () => {
		fetchMock.mockResolvedValueOnce(page([1], 1, 25, 1));
		for await (const [err, batch] of articles.pages({ params: { fields: ["title"] } })) {
			if (err) throw new Error(err.message);
			expectTypeOf(batch).toEqualTypeOf<{ id: number; documentId: string; title: string }[]>();
		}
	});

	it("hands the error out and stops", async () => {
		fetchMock.mockResolvedValueOnce(page([1], 1, 1, 10)).mockResolvedValueOnce(new Response("boom", { status: 500 }));

		const results: (number | string)[] = [];
		for await (const [err, batch] of articles.pages({ params: { pagination: { pageSize: 1 } } })) {
			if (err) {
				results.push(err.status ?? 0);
				break;
			}
			results.push(batch.length);
		}
		expect(results).toEqual([1, 500]);
	});

	it("walks offset pagination too", async () => {
		fetchMock
			.mockResolvedValueOnce(jsonResponse({ data: [{ id: 1 }], meta: { pagination: { start: 0, limit: 1, total: 2 } } }))
			.mockResolvedValueOnce(jsonResponse({ data: [{ id: 2 }], meta: { pagination: { start: 1, limit: 1, total: 2 } } }));

		const seen: number[] = [];
		for await (const [, batch] of articles.pages({ params: { pagination: { start: 0, limit: 1 } } })) {
			seen.push(...(batch ?? []).map((a) => a.id));
		}
		expect(seen).toEqual([1, 2]);
		expect(decodeURIComponent(String(fetchMock.mock.calls[1]?.[0]))).toContain("pagination[start]=1");
	});

	it("keeps asking in offsets when the server answers in pages", async () => {
		fetchMock
			.mockResolvedValueOnce(page([1, 2], 1, 2, 3))
			.mockResolvedValueOnce(page([3], 2, 2, 3));

		const seen: number[] = [];
		for await (const [, batch] of articles.pages({ params: { pagination: { start: 0, limit: 2 } } })) {
			seen.push(...(batch ?? []).map((a) => a.id));
		}
		expect(seen).toEqual([1, 2, 3]);
		expect(decodeURIComponent(String(fetchMock.mock.calls[1]?.[0]))).toContain("pagination[start]=2");
	});

	it("stops after a page with no meta, since there is no way to ask for more", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({ data: [{ id: 1 }] }));
		const seen: number[] = [];
		for await (const [, batch] of articles.pages()) seen.push(...(batch ?? []).map((a) => a.id));
		expect(seen).toEqual([1]);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("stops on an empty page rather than looping", async () => {
		fetchMock.mockResolvedValue(jsonResponse({ data: [], meta: { pagination: { page: 1, pageSize: 25, pageCount: 4, total: 90 } } }));
		let pages = 0;
		for await (const [, batch] of articles.pages()) {
			pages += 1;
			expect(batch).toEqual([]);
		}
		expect(pages).toBe(1);
	});
});
