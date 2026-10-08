import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import { Strapi } from "../index";
import type { ListQueryParams, StrapiDocument, StrapiMedia } from "../types";
import { installFetchMock, jsonResponse, type FetchMock } from "./helpers";

interface Article extends StrapiDocument {
	readonly __populatable?: "cover" | "author";
	title: string;
	views?: number;
	cover?: StrapiMedia | null;
	author?: { documentId: string; name: string } | null;
}

describe("reads narrowed by their params", () => {
	let fetchMock: FetchMock;
	const strapi = new Strapi({ baseURL: "http://h", defaultLocale: "en" });
	const articles = strapi.collection<Article>("articles");
	const homepage = strapi.single<Article>("homepage");

	beforeEach(() => {
		fetchMock = installFetchMock();
	});
	afterEach(() => vi.restoreAllMocks());

	it("returns only the selected fields", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({ data: [{ id: 1, documentId: "a", title: "A" }] }));
		const [err, data] = await articles.findMany({ params: { fields: ["title"] } });
		if (err) throw new Error(err.message);
		expectTypeOf(data).toEqualTypeOf<{ id: number; documentId: string; title: string }[]>();
		expect(data[0]?.title).toBe("A");
	});

	it("leaves unpopulated relations off the result", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({ data: [] }));
		const [err, data] = await articles.findMany();
		if (err) throw new Error(err.message);
		expectTypeOf<(typeof data)[number]>().toHaveProperty("title");
		const rejected = () => {
			// @ts-expect-error author was not populated, so Strapi does not return it
			void data[0]?.author;
		};
		expect(rejected).toBeTypeOf("function");
	});

	it("adds populated relations as required properties", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({ data: [{ id: 1, documentId: "a", title: "A", author: null }] }));
		const [err, data] = await articles.findMany({ params: { populate: ["author"] } });
		if (err) throw new Error(err.message);
		expectTypeOf(data[0]?.author).toEqualTypeOf<{ documentId: string; name: string } | null | undefined>();
	});

	it("narrows find, findFirst and the single-type client the same way", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({ data: { id: 1, documentId: "a", title: "A" } }));
		const [findErr, one] = await articles.find({ documentId: "a", params: { fields: ["title"] } });
		if (findErr) throw new Error(findErr.message);
		expectTypeOf(one).toEqualTypeOf<{ id: number; documentId: string; title: string }>();

		fetchMock.mockResolvedValueOnce(jsonResponse({ data: [{ id: 1, documentId: "a", title: "A" }] }));
		const [firstErr, first] = await articles.findFirst({ params: { fields: ["title"] } });
		if (firstErr) throw new Error(firstErr.message);
		expectTypeOf(first).toEqualTypeOf<{ id: number; documentId: string; title: string } | null>();

		fetchMock.mockResolvedValueOnce(jsonResponse({ data: { id: 1, documentId: "h", title: "H", cover: null } }));
		const [pageErr, page] = await homepage.find({ params: { populate: "*" } });
		if (pageErr) throw new Error(pageErr.message);
		expectTypeOf(page.cover).toEqualTypeOf<StrapiMedia | null>();
	});

	it("keeps every field when the params are held in a variable", async () => {
		const params: ListQueryParams<Article> = { fields: ["title"] };
		fetchMock.mockResolvedValueOnce(jsonResponse({ data: [] }));
		const [err, data] = await articles.findMany({ params });
		if (err) throw new Error(err.message);
		expectTypeOf(data).toEqualTypeOf<Article[]>();
	});

	it("still fetches every page with all: true", async () => {
		fetchMock.mockResolvedValueOnce(
			jsonResponse({ data: [{ id: 1, documentId: "a", title: "A" }], meta: { pagination: { page: 1, pageSize: 25, pageCount: 1, total: 1 } } })
		);
		const [err, data] = await articles.findMany({ all: true, params: { fields: ["title"] } });
		if (err) throw new Error(err.message);
		expectTypeOf(data).toEqualTypeOf<{ id: number; documentId: string; title: string }[]>();
		expect(data).toHaveLength(1);
	});
});
