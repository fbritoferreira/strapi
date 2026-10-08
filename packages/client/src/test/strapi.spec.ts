import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import { CollectionClient } from "../clients/collection";
import { FilesClient } from "../clients/files";
import { SingleTypeClient } from "../clients/single";
import { UsersClient } from "../clients/users";
import { Strapi } from "../strapi";
import { installFetchMock, jsonResponse, lastCall, type FetchMock } from "./helpers";

interface Article {
	documentId: string;
	title: string;
}

describe("Strapi", () => {
	let fetchMock: FetchMock;

	beforeEach(() => {
		fetchMock = installFetchMock();
	});

	afterEach(() => vi.restoreAllMocks());

	it("requires defaultLocale", () => {
		// @ts-expect-error defaultLocale is required
		expect(() => new Strapi({ baseURL: "http://h" })).toThrow(TypeError);
		expect(() => new Strapi({ baseURL: "http://h", defaultLocale: "" })).toThrow(/defaultLocale/);
	});

	it("requires baseURL", () => {
		expect(() => new Strapi({ baseURL: "", defaultLocale: "en" })).toThrow(/baseURL/);
	});

	it("exposes normalized config", () => {
		const strapi = new Strapi({ baseURL: "http://h/", defaultLocale: "de", concurrency: 3 });
		expect(strapi.http.baseURL).toBe("http://h/api");
		expect(strapi.defaultLocale).toBe("de");
		expect(strapi.concurrency).toBe(3);
	});

	it("defaults concurrency to 5", () => {
		expect(new Strapi({ baseURL: "http://h", defaultLocale: "en" }).concurrency).toBe(5);
	});

	it("hands out clients sharing the http instance", async () => {
		const strapi = new Strapi({ baseURL: "http://h", defaultLocale: "en", token: "tok" });
		const articles = strapi.collection<Article>("articles");
		const home = strapi.single<Article>("homepage");
		expect(articles).toBeInstanceOf(CollectionClient);
		expect(home).toBeInstanceOf(SingleTypeClient);
		expect(strapi.users()).toBeInstanceOf(UsersClient);
		expect(strapi.files).toBeInstanceOf(FilesClient);

		fetchMock.mockResolvedValueOnce(jsonResponse({ data: [] }));
		await articles.findMany({ locale: "en" });
		expect(lastCall(fetchMock).url).toBe("http://h/api/articles");
		expect(new Headers(lastCall(fetchMock).init.headers).get("authorization")).toBe("Bearer tok");
	});

	it("applies defaultLocale to sub-clients", async () => {
		const strapi = new Strapi({ baseURL: "http://h", defaultLocale: "de" });
		fetchMock.mockResolvedValueOnce(jsonResponse({ data: [] }));
		await strapi.collection<Article>("articles").findMany({ locale: "en" });
		expect(lastCall(fetchMock).url).toBe("http://h/api/articles?locale=en");
		fetchMock.mockResolvedValueOnce(jsonResponse({ data: [] }));
		await strapi.collection<Article>("articles").findMany({ locale: "de" });
		expect(lastCall(fetchMock).url).toBe("http://h/api/articles");
	});

	it("types a uid from an explicit type argument", () => {
		const strapi = new Strapi({ baseURL: "http://h", defaultLocale: "en" });
		expectTypeOf(strapi.collection<Article>("anything")).toEqualTypeOf<CollectionClient<Article>>();
		expectTypeOf(strapi.collection<Article>("articles")).toEqualTypeOf<CollectionClient<Article>>();
	});
});
