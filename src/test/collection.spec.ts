import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CollectionClient } from "../clients/collection";
import { HttpClient } from "../http";
import { emptyResponse, errorResponse, installFetchMock, jsonResponse, lastCall, type FetchMock } from "./helpers";

interface Article {
	id: number;
	documentId: string;
	title: string;
	locale?: string;
}

const doc = (documentId: string, title = "t"): Article => ({ id: 1, documentId, title });
const decoded = (mock: FetchMock) => decodeURIComponent(lastCall(mock).url);
const bodyOf = (mock: FetchMock) => JSON.parse(String(lastCall(mock).init.body));

describe("CollectionClient", () => {
	let fetchMock: FetchMock;
	let articles: CollectionClient<Article>;

	beforeEach(() => {
		fetchMock = installFetchMock();
		const http = new HttpClient({ baseURL: "http://h", token: "tok" });
		articles = new CollectionClient<Article>({ http, defaultLocale: "en", concurrency: 2 }, "articles");
	});

	afterEach(() => vi.restoreAllMocks());

	describe("findMany", () => {
		it("returns data and meta", async () => {
			const meta = { pagination: { page: 1, pageSize: 25, pageCount: 1, total: 1 } };
			fetchMock.mockResolvedValueOnce(jsonResponse({ data: [doc("a")], meta }));
			const [err, data, m] = await articles.findMany();
			expect(err).toBeNull();
			expect(data).toEqual([doc("a")]);
			expect(m).toEqual(meta);
			expect(lastCall(fetchMock).url).toBe("http://h/api/articles");
			expect(lastCall(fetchMock).init.method).toBe("GET");
		});

		it("serializes params and non-default locale", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse({ data: [] }));
			await articles.findMany({ params: { filters: { title: { $eq: "x" } } }, locale: "fr" });
			expect(decoded(fetchMock)).toBe("http://h/api/articles?filters[title][$eq]=x&locale=fr");
		});

		it("omits default locale", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse({ data: [] }));
			await articles.findMany({ locale: "en" });
			expect(lastCall(fetchMock).url).toBe("http://h/api/articles");
		});

		it("returns [] when body has no data", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse({}));
			const [err, data, meta] = await articles.findMany();
			expect(err).toBeNull();
			expect(data).toEqual([]);
			expect(meta).toBeNull();
		});

		it("returns errors", async () => {
			fetchMock.mockResolvedValueOnce(errorResponse(401, "UnauthorizedError", "Missing or invalid credentials"));
			const [err, data, meta] = await articles.findMany();
			expect(err?.status).toBe(401);
			expect(data).toBeNull();
			expect(meta).toBeNull();
		});

		it("delegates to fetchAll when all is true", async () => {
			fetchMock
				.mockResolvedValueOnce(jsonResponse({ data: [doc("a")], meta: { pagination: { page: 1, pageSize: 1, pageCount: 2, total: 2 } } }))
				.mockResolvedValueOnce(jsonResponse({ data: [doc("b")], meta: { pagination: { page: 2, pageSize: 1, pageCount: 2, total: 2 } } }));
			const [err, data, meta] = await articles.findMany({ all: true, params: { pagination: { pageSize: 1 } } });
			expect(err).toBeNull();
			expect(data?.map((d) => d.documentId)).toEqual(["a", "b"]);
			expect(meta).toEqual({ pagination: { page: 1, pageSize: 2, pageCount: 1, total: 2 } });
		});

		it("passes init through", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse({ data: [] }));
			await articles.findMany({ init: { cache: "no-store" } });
			expect(lastCall(fetchMock).init.cache).toBe("no-store");
		});

		it("passes locale and init through to fetchAll", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse({ data: [doc("a")], meta: { pagination: { page: 1, pageSize: 1, pageCount: 1, total: 1 } } }));
			await articles.findMany({ all: true, locale: "fr", init: { cache: "no-store" } });
			expect(decoded(fetchMock)).toContain("locale=fr");
			expect(lastCall(fetchMock).init.cache).toBe("no-store");
		});
	});

	describe("find", () => {
		it("gets by documentId with params", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse({ data: doc("abc"), meta: {} }));
			const [err, data, meta] = await articles.find({ documentId: "abc", params: { populate: "*" } });
			expect(err).toBeNull();
			expect(data).toEqual(doc("abc"));
			expect(meta).toEqual({});
			expect(decoded(fetchMock)).toBe("http://h/api/articles/abc?populate=*");
		});

		it("returns NotFoundError when data is null", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse({ data: null }));
			const [err, data] = await articles.find({ documentId: "abc" });
			expect(err).toEqual({ status: 404, name: "NotFoundError", message: "Not Found" });
			expect(data).toBeNull();
		});

		it("returns http errors", async () => {
			fetchMock.mockResolvedValueOnce(errorResponse(404, "NotFoundError", "Not Found"));
			const [err] = await articles.find({ documentId: "zzz" });
			expect(err?.name).toBe("NotFoundError");
		});

		it("encodes documentId with special characters", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse({ data: doc("a b/c") }));
			await articles.find({ documentId: "a b/c" });
			expect(lastCall(fetchMock).url).toContain("articles/a%20b%2Fc");
		});

		it("passes init through", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse({ data: doc("abc") }));
			await articles.find({ documentId: "abc", init: { cache: "no-store" } });
			expect(lastCall(fetchMock).init.cache).toBe("no-store");
		});
	});

	describe("findFirst", () => {
		it("returns the first item with pageSize 1", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse({ data: [doc("a"), doc("b")] }));
			const [err, data] = await articles.findFirst({ params: { sort: ["title:asc"] }, locale: "fr" });
			expect(err).toBeNull();
			expect(data).toEqual(doc("a"));
			expect(decoded(fetchMock)).toBe("http://h/api/articles?sort[0]=title:asc&pagination[pageSize]=1&locale=fr");
		});

		it("returns null when empty", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse({ data: [] }));
			const [err, data] = await articles.findFirst();
			expect(err).toBeNull();
			expect(data).toBeNull();
		});

		it("forces limit 1 instead of pageSize for offset-shaped pagination", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse({ data: [doc("a")] }));
			await articles.findFirst({ params: { pagination: { start: 0, limit: 10 } } });
			expect(decoded(fetchMock)).toBe("http://h/api/articles?pagination[start]=0&pagination[limit]=1");
		});

		it("passes init through", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse({ data: [doc("a")] }));
			await articles.findFirst({ init: { cache: "no-store" } });
			expect(lastCall(fetchMock).init.cache).toBe("no-store");
		});

		it("returns errors", async () => {
			fetchMock.mockResolvedValueOnce(errorResponse(500, "InternalServerError", "x"));
			const [err] = await articles.findFirst();
			expect(err?.status).toBe(500);
		});
	});

	describe("count", () => {
		it("returns meta.pagination.total", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse({ data: [doc("a")], meta: { pagination: { page: 1, pageSize: 1, pageCount: 7, total: 7 } } }));
			const [err, total] = await articles.count({ params: { filters: { title: { $contains: "a" } } } });
			expect(err).toBeNull();
			expect(total).toBe(7);
			expect(decoded(fetchMock)).toContain("pagination[pageSize]=1");
			expect(decoded(fetchMock)).toContain("filters[title][$contains]=a");
		});

		it("falls back to data length without meta", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse({ data: [doc("a"), doc("b")] }));
			const [, total] = await articles.count();
			expect(total).toBe(2);
		});

		it("falls back to data length when meta has no pagination", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse({ data: [doc("a"), doc("b")], meta: {} }));
			const [, total] = await articles.count();
			expect(total).toBe(2);
		});

		it("passes locale and init through", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse({ data: [doc("a")], meta: { pagination: { page: 1, pageSize: 1, pageCount: 1, total: 1 } } }));
			await articles.count({ locale: "fr", init: { cache: "no-store" } });
			expect(decoded(fetchMock)).toContain("locale=fr");
			expect(lastCall(fetchMock).init.cache).toBe("no-store");
		});

		it("returns errors", async () => {
			fetchMock.mockResolvedValueOnce(errorResponse(403, "ForbiddenError", "Forbidden"));
			const [err, total] = await articles.count();
			expect(err?.status).toBe(403);
			expect(total).toBeNull();
		});
	});

	describe("create", () => {
		const payload = { data: { title: "New" } };

		it("posts to the collection for the default locale, with params", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse({ data: doc("n", "New") }, 201));
			const [err, data] = await articles.create({ payload, params: { status: "published" } });
			expect(err).toBeNull();
			expect(data).toEqual(doc("n", "New"));
			expect(decoded(fetchMock)).toBe("http://h/api/articles?status=published");
			expect(lastCall(fetchMock).init.method).toBe("POST");
			expect(bodyOf(fetchMock)).toEqual(payload);
		});

		it("returns errors from the default-locale post", async () => {
			fetchMock.mockResolvedValueOnce(errorResponse(400, "ValidationError", "title must be unique", { errors: [] }));
			const [err] = await articles.create({ payload });
			expect(err?.name).toBe("ValidationError");
			expect(err?.details).toEqual({ errors: [] });
		});

		it("returns NotFoundError when the default-locale post response has no data", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse({ data: null }, 201));
			const [err, data] = await articles.create({ payload });
			expect(err).toEqual({ status: 404, name: "NotFoundError", message: "Not Found" });
			expect(data).toBeNull();
		});

		it("links a localization to an existing default-locale document", async () => {
			fetchMock
				.mockResolvedValueOnce(jsonResponse({ data: [doc("base")] }))
				.mockResolvedValueOnce(jsonResponse({ data: { ...doc("base", "Nouveau"), locale: "fr" } }));
			const [err, data] = await articles.create({ payload, locale: "fr", filters: { title: { $eq: "New" } } });
			expect(err).toBeNull();
			expect(data?.locale).toBe("fr");
			const urls = fetchMock.mock.calls.map(([u]) => decodeURIComponent(String(u)));
			expect(urls[0]).toBe("http://h/api/articles?filters[title][$eq]=New&pagination[pageSize]=1");
			expect(urls[1]).toBe("http://h/api/articles/base?locale=fr");
			expect(lastCall(fetchMock).init.method).toBe("PUT");
			expect(bodyOf(fetchMock)).toEqual(payload);
		});

		it("excludes caller params from the base-document search", async () => {
			fetchMock
				.mockResolvedValueOnce(jsonResponse({ data: [doc("base")] }))
				.mockResolvedValueOnce(jsonResponse({ data: { ...doc("base", "Nouveau"), locale: "fr" } }));
			await articles.create({
				payload,
				locale: "fr",
				filters: { title: { $eq: "New" } },
				params: { status: "published", populate: "*" },
				init: { cache: "no-store" },
			});
			const urls = fetchMock.mock.calls.map(([u]) => decodeURIComponent(String(u)));
			expect(urls[0]).toBe("http://h/api/articles?filters[title][$eq]=New&pagination[pageSize]=1");
			expect(lastCall(fetchMock).init.cache).toBe("no-store");
		});

		it("creates the default-locale document first when none exists", async () => {
			fetchMock
				.mockResolvedValueOnce(jsonResponse({ data: [] }))
				.mockResolvedValueOnce(jsonResponse({ data: doc("fresh") }, 201))
				.mockResolvedValueOnce(jsonResponse({ data: { ...doc("fresh"), locale: "de" } }));
			const [err, data] = await articles.create({
				payload,
				locale: "de",
				filters: { title: { $eq: "New" } },
				params: { status: "published" },
			});
			expect(err).toBeNull();
			expect(data?.documentId).toBe("fresh");
			const secondBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
			expect(secondBody).toEqual({ data: { title: "New", locale: "en" } });
			expect(decodeURIComponent(String(fetchMock.mock.calls[1]?.[0]))).toBe("http://h/api/articles?status=published");
			expect(decoded(fetchMock)).toBe("http://h/api/articles/fresh?status=published&locale=de");
		});

		it("returns an error when the created base document has no documentId", async () => {
			fetchMock
				.mockResolvedValueOnce(jsonResponse({ data: [] }))
				.mockResolvedValueOnce(jsonResponse({ data: { id: 1 } }, 201));
			const [err, data] = await articles.create({ payload, locale: "fr", filters: { title: { $eq: "New" } } });
			expect(err?.name).toBe("HTTPError");
			expect(err?.message).toContain("documentId");
			expect(data).toBeNull();
			expect(fetchMock).toHaveBeenCalledTimes(2);
		});

		it("returns the search error for a non-default locale", async () => {
			fetchMock.mockResolvedValueOnce(errorResponse(500, "InternalServerError", "x"));
			const [err] = await articles.create({ payload, locale: "fr", filters: { title: { $eq: "New" } } });
			expect(err?.status).toBe(500);
			expect(fetchMock).toHaveBeenCalledTimes(1);
		});

		it("returns the base create error for a non-default locale", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse({ data: [] })).mockResolvedValueOnce(errorResponse(400, "ValidationError", "bad"));
			const [err] = await articles.create({ payload, locale: "fr", filters: { title: { $eq: "New" } } });
			expect(err?.name).toBe("ValidationError");
			expect(fetchMock).toHaveBeenCalledTimes(2);
		});

		it("returns the localization put error", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse({ data: [doc("base")] })).mockResolvedValueOnce(errorResponse(400, "ValidationError", "bad"));
			const [err] = await articles.create({ payload, locale: "fr", filters: { title: { $eq: "New" } } });
			expect(err?.name).toBe("ValidationError");
		});

		it("creates a fresh default-locale document when no filters are supplied", async () => {
			fetchMock
				.mockResolvedValueOnce(jsonResponse({ data: doc("fresh") }, 201))
				.mockResolvedValueOnce(jsonResponse({ data: { ...doc("fresh"), locale: "fr" } }));
			const [err, data] = await articles.create({ payload, locale: "fr" });
			expect(err).toBeNull();
			expect(data?.locale).toBe("fr");
			expect(fetchMock).toHaveBeenCalledTimes(2);
			const urls = fetchMock.mock.calls.map(([u]) => decodeURIComponent(String(u)));
			expect(urls[0]).toBe("http://h/api/articles");
			expect(urls[1]).toBe("http://h/api/articles/fresh?locale=fr");
			expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("POST");
			expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({ data: { title: "New", locale: "en" } });
			expect(fetchMock.mock.calls[1]?.[1]?.method).toBe("PUT");
		});
	});

	describe("update", () => {
		it("puts by documentId with params and locale", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse({ data: doc("abc", "Up") }));
			const [err, data] = await articles.update({ documentId: "abc", payload: { data: { title: "Up" } }, params: { status: "published" }, locale: "fr" });
			expect(err).toBeNull();
			expect(data?.title).toBe("Up");
			expect(decoded(fetchMock)).toBe("http://h/api/articles/abc?status=published&locale=fr");
			expect(lastCall(fetchMock).init.method).toBe("PUT");
			expect(bodyOf(fetchMock)).toEqual({ data: { title: "Up" } });
		});

		it("omits query for default locale without params", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse({ data: doc("abc") }));
			await articles.update({ documentId: "abc", payload: { data: {} } });
			expect(lastCall(fetchMock).url).toBe("http://h/api/articles/abc");
		});

		it("returns errors", async () => {
			fetchMock.mockResolvedValueOnce(errorResponse(404, "NotFoundError", "Not Found"));
			const [err, data] = await articles.update({ documentId: "abc", payload: { data: {} } });
			expect(err?.status).toBe(404);
			expect(data).toBeNull();
		});

		it("returns NotFoundError when the response has no data", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse({ data: null }));
			const [err, data] = await articles.update({ documentId: "abc", payload: { data: {} } });
			expect(err).toEqual({ status: 404, name: "NotFoundError", message: "Not Found" });
			expect(data).toBeNull();
		});

		it("passes init through", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse({ data: doc("abc") }));
			await articles.update({ documentId: "abc", payload: { data: {} }, init: { cache: "no-store" } });
			expect(lastCall(fetchMock).init.cache).toBe("no-store");
		});
	});

	describe("delete", () => {
		it("sends DELETE and returns null on 204", async () => {
			fetchMock.mockResolvedValueOnce(emptyResponse(204));
			const [err, data, meta] = await articles.delete({ documentId: "abc" });
			expect(err).toBeNull();
			expect(data).toBeNull();
			expect(meta).toBeNull();
			expect(lastCall(fetchMock).url).toBe("http://h/api/articles/abc");
			expect(lastCall(fetchMock).init.method).toBe("DELETE");
		});

		it("deletes one localization", async () => {
			fetchMock.mockResolvedValueOnce(emptyResponse(204));
			await articles.delete({ documentId: "abc", locale: "fr" });
			expect(lastCall(fetchMock).url).toBe("http://h/api/articles/abc?locale=fr");
		});

		it("returns errors", async () => {
			fetchMock.mockResolvedValueOnce(errorResponse(404, "NotFoundError", "Not Found"));
			const [err] = await articles.delete({ documentId: "abc" });
			expect(err?.status).toBe(404);
		});
	});

	describe("upsert", () => {
		const payload = { data: { title: "T" } };

		it("updates the first match by documentId", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse({ data: [doc("found")] })).mockResolvedValueOnce(jsonResponse({ data: doc("found", "T") }));
			const [err, data] = await articles.upsert({ payload, filters: { title: { $eq: "T" } }, locale: "fr" });
			expect(err).toBeNull();
			expect(data?.documentId).toBe("found");
			const urls = fetchMock.mock.calls.map(([u]) => decodeURIComponent(String(u)));
			expect(urls[0]).toBe("http://h/api/articles?filters[title][$eq]=T&pagination[pageSize]=1&locale=fr");
			expect(urls[1]).toBe("http://h/api/articles/found?locale=fr");
			expect(lastCall(fetchMock).init.method).toBe("PUT");
		});

		it("creates when nothing matches", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse({ data: [] })).mockResolvedValueOnce(jsonResponse({ data: doc("new", "T") }, 201));
			const [err, data] = await articles.upsert({ payload, filters: { title: { $eq: "T" } } });
			expect(err).toBeNull();
			expect(data?.documentId).toBe("new");
			expect(lastCall(fetchMock).init.method).toBe("POST");
		});

		it("returns the search error", async () => {
			fetchMock.mockResolvedValueOnce(errorResponse(500, "InternalServerError", "x"));
			const [err] = await articles.upsert({ payload });
			expect(err?.status).toBe(500);
			expect(fetchMock).toHaveBeenCalledTimes(1);
		});

		it("falls through to create for a non-default locale when nothing matches", async () => {
			fetchMock
				.mockResolvedValueOnce(jsonResponse({ data: [] }))
				.mockResolvedValueOnce(jsonResponse({ data: [doc("base")] }))
				.mockResolvedValueOnce(jsonResponse({ data: { ...doc("base", "T"), locale: "fr" } }));
			const [err, data] = await articles.upsert({ payload, filters: { title: { $eq: "T" } }, locale: "fr" });
			expect(err).toBeNull();
			expect(data?.locale).toBe("fr");
			const urls = fetchMock.mock.calls.map(([u]) => decodeURIComponent(String(u)));
			expect(urls[0]).toBe("http://h/api/articles?filters[title][$eq]=T&pagination[pageSize]=1&locale=fr");
			expect(urls[1]).toBe("http://h/api/articles?filters[title][$eq]=T&pagination[pageSize]=1");
			expect(urls[2]).toBe("http://h/api/articles/base?locale=fr");
			expect(lastCall(fetchMock).init.method).toBe("PUT");
			expect(fetchMock).toHaveBeenCalledTimes(3);
		});

		it("passes params and init through when updating the found match", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse({ data: [doc("found")] })).mockResolvedValueOnce(jsonResponse({ data: doc("found", "T") }));
			await articles.upsert({
				payload,
				filters: { title: { $eq: "T" } },
				params: { status: "published" },
				init: { cache: "no-store" },
			});
			expect(lastCall(fetchMock).url).toContain("status=published");
			expect(lastCall(fetchMock).init.cache).toBe("no-store");
		});

		it("passes params and init through when creating", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse({ data: [] })).mockResolvedValueOnce(jsonResponse({ data: doc("new", "T") }, 201));
			await articles.upsert({
				payload,
				filters: { title: { $eq: "T" } },
				params: { status: "published" },
				init: { cache: "no-store" },
			});
			expect(decoded(fetchMock)).toContain("status=published");
			expect(lastCall(fetchMock).init.cache).toBe("no-store");
		});
	});
});
