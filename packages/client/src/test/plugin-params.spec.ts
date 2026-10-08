import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import { Strapi } from "../index";
import type { PluginFindQueryParams, PluginListQueryParams, StrapiMedia, StrapiRole, StrapiUser } from "../types";
import { installFetchMock, jsonResponse, lastCall, type FetchMock } from "./helpers";

describe("plugin clients follow their own routes", () => {
	let fetchMock: FetchMock;
	const strapi = new Strapi({ baseURL: "http://h", defaultLocale: "en" });

	beforeEach(() => {
		fetchMock = installFetchMock();
	});
	afterEach(() => vi.restoreAllMocks());

	it("lists users with the params /api/users accepts", () => {
		expectTypeOf<keyof PluginListQueryParams<StrapiUser>>().toEqualTypeOf<
			"fields" | "filters" | "sort" | "populate" | "pagination"
		>();
		expectTypeOf<keyof PluginFindQueryParams<StrapiUser>>().toEqualTypeOf<"fields" | "populate">();
	});

	it("keeps content-API-only params off the users routes", () => {
		const rejected = () => {
			// @ts-expect-error /api/users is not a content-API route and takes no status
			strapi.users().findMany({ params: { status: "draft" } });
			// @ts-expect-error nor a locale
			strapi.users().findMany({ params: { locale: "fr" } });
			// @ts-expect-error /api/users/me takes only fields and populate
			strapi.users().me({ params: { sort: ["username"] } });
			// @ts-expect-error /api/users/count takes filters only
			strapi.users().count({ params: { fields: ["username"] } });
		};
		expect(rejected).toBeTypeOf("function");
	});

	it("keeps them off the upload routes too", () => {
		const rejected = () => {
			// @ts-expect-error /api/upload/files takes no status
			strapi.files.find({ params: { status: "draft" } });
		};
		expect(rejected).toBeTypeOf("function");
	});

	it("selects fields when reading one file", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({ id: 1, url: "/a.png" }));
		await strapi.files.findOne({ id: 1, params: { fields: ["url"] } });
		expect(decodeURIComponent(lastCall(fetchMock).url)).toBe("http://h/api/upload/files/1?fields[0]=url");
	});

	it("types the user role the way users-permissions returns it", () => {
		expectTypeOf<StrapiUser["role"]>().toEqualTypeOf<number | StrapiRole | undefined>();
		expectTypeOf<StrapiRole["description"]>().toEqualTypeOf<string | null>();
	});

	it("carries the upload fields Strapi returns", () => {
		expectTypeOf<StrapiMedia["focalPoint"]>().toEqualTypeOf<unknown>();
		expectTypeOf<StrapiMedia["related"]>().toEqualTypeOf<unknown>();
	});
});

describe("delete takes the params its route accepts", () => {
	let fetchMock: FetchMock;
	const strapi = new Strapi({ baseURL: "http://h", defaultLocale: "en" });

	beforeEach(() => {
		fetchMock = installFetchMock();
	});
	afterEach(() => vi.restoreAllMocks());

	interface Article {
		documentId: string;
		title: string;
	}

	it("sends fields, populate and filters, and returns the deleted document", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({ data: { documentId: "a", title: "A" } }));
		const [err, deleted] = await strapi.collection<Article>("articles").delete({
			documentId: "a",
			params: { fields: ["title"] },
		});
		if (err) throw new Error(err.message);
		expect(decodeURIComponent(lastCall(fetchMock).url)).toBe("http://h/api/articles/a?fields[0]=title");
		expect(deleted?.title).toBe("A");
	});

	it("returns null when Strapi answers with no body", async () => {
		fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
		const [err, deleted] = await strapi.collection<Article>("articles").delete({ documentId: "a" });
		if (err) throw new Error(err.message);
		expect(deleted).toBeNull();
	});

	it("takes fields and populate on a single type", async () => {
		fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
		await strapi.single<Article>("homepage").delete({ params: { fields: ["title"] } });
		expect(decodeURIComponent(lastCall(fetchMock).url)).toBe("http://h/api/homepage?fields[0]=title");
		const rejected = () => {
			// @ts-expect-error the single-type delete route takes no filters
			strapi.single<Article>("homepage").delete({ params: { filters: { title: "A" } } });
		};
		expect(rejected).toBeTypeOf("function");
	});
});
