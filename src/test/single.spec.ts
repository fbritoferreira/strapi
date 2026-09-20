import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SingleTypeClient } from "../clients/single";
import { HttpClient } from "../http";
import { emptyResponse, errorResponse, installFetchMock, jsonResponse, lastCall, type FetchMock } from "./helpers";

interface Homepage {
	documentId: string;
	heading: string;
}

describe("SingleTypeClient", () => {
	let fetchMock: FetchMock;
	let home: SingleTypeClient<Homepage>;

	beforeEach(() => {
		fetchMock = installFetchMock();
		home = new SingleTypeClient<Homepage>(
			{ http: new HttpClient({ baseURL: "http://h" }), defaultLocale: "en", concurrency: 1 },
			"homepage"
		);
	});

	afterEach(() => vi.restoreAllMocks());

	it("find gets the singular path with params and locale", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({ data: { documentId: "h", heading: "Hi" }, meta: {} }));
		const [err, data, meta] = await home.find({ params: { populate: "*" }, locale: "fr" });
		expect(err).toBeNull();
		expect(data?.heading).toBe("Hi");
		expect(meta).toEqual({});
		expect(decodeURIComponent(lastCall(fetchMock).url)).toBe("http://h/api/homepage?populate=*&locale=fr");
		expect(lastCall(fetchMock).init.method).toBe("GET");
	});

	it("find returns NotFoundError when data is null", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({ data: null }));
		const [err] = await home.find();
		expect(err).toEqual({ status: 404, name: "NotFoundError", message: "Not Found" });
	});

	it("find returns http errors", async () => {
		fetchMock.mockResolvedValueOnce(errorResponse(403, "ForbiddenError", "Forbidden"));
		const [err] = await home.find();
		expect(err?.status).toBe(403);
	});

	it("update puts the payload", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({ data: { documentId: "h", heading: "New" } }));
		const [err, data] = await home.update({ payload: { data: { heading: "New" } }, params: { status: "published" } });
		expect(err).toBeNull();
		expect(data?.heading).toBe("New");
		expect(lastCall(fetchMock).url).toBe("http://h/api/homepage?status=published");
		expect(lastCall(fetchMock).init.method).toBe("PUT");
		expect(JSON.parse(String(lastCall(fetchMock).init.body))).toEqual({ data: { heading: "New" } });
	});

	it("update returns errors", async () => {
		fetchMock.mockResolvedValueOnce(errorResponse(400, "ValidationError", "bad"));
		const [err, data] = await home.update({ payload: { data: {} } });
		expect(err?.name).toBe("ValidationError");
		expect(data).toBeNull();
	});

	it("delete sends DELETE with optional locale", async () => {
		fetchMock.mockResolvedValueOnce(emptyResponse());
		const [err, data] = await home.delete({ locale: "fr" });
		expect(err).toBeNull();
		expect(data).toBeNull();
		expect(lastCall(fetchMock).url).toBe("http://h/api/homepage?locale=fr");
		expect(lastCall(fetchMock).init.method).toBe("DELETE");
	});

	it("delete returns errors", async () => {
		fetchMock.mockResolvedValueOnce(errorResponse(404, "NotFoundError", "Not Found"));
		const [err] = await home.delete();
		expect(err?.status).toBe(404);
	});
});
