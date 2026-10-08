import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import { Strapi } from "../index";
import { installFetchMock, jsonResponse, lastCall, type FetchMock } from "./helpers";

interface Article {
	documentId: string;
	title: string;
	views: number | null;
	author: { name: string; email: string | null } | null;
}

declare module "../index" {
	interface StrapiGraphqlQueries {
		articles: { args: { locale?: string | null; limit?: number | null }; result: Article[] };
		article: { args: { documentId: string }; result: Article | null };
	}
	interface StrapiGraphqlMutations {
		createArticle: { args: { data: { title: string } }; result: Article | null };
	}
}

const argTypes = {
	queries: { articles: { locale: "I18NLocaleCode", limit: "Int" }, article: { documentId: "ID!" } },
	mutations: { createArticle: { data: "ArticleInput!" } },
};

describe("strapi.query", () => {
	let fetchMock: FetchMock;
	const strapi = new Strapi({ baseURL: "http://h", defaultLocale: "en", graphqlArgs: argTypes });

	beforeEach(() => {
		fetchMock = installFetchMock();
	});
	afterEach(() => vi.restoreAllMocks());

	const sent = () => JSON.parse(String(lastCall(fetchMock).init.body)) as { query: string; variables: unknown };

	it("builds the document from the field, args and selection", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({ data: { articles: [{ documentId: "a", title: "A" }] } }));
		const [err, data] = await strapi.query("articles", {
			args: { locale: "fr" },
			select: { documentId: true, title: true },
		});
		if (err) throw new Error(err.message);

		expect(sent().query).toBe("query Articles($locale: I18NLocaleCode) { articles(locale: $locale) { documentId title } }");
		expect(sent().variables).toEqual({ locale: "fr" });
		expect(data).toEqual([{ documentId: "a", title: "A" }]);
		expectTypeOf(data).toEqualTypeOf<{ documentId: string; title: string }[]>();
	});

	it("narrows a nested selection, keeping the relation nullable", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({ data: { articles: [{ author: { name: "Ada" } }] } }));
		const [err, data] = await strapi.query("articles", { select: { author: { name: true } } });
		if (err) throw new Error(err.message);

		expect(sent().query).toBe("query Articles { articles { author { name } } }");
		expectTypeOf(data).toEqualTypeOf<{ author: { name: string } | null }[]>();
	});

	it("keeps a single-document result nullable", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({ data: { article: null } }));
		const [err, data] = await strapi.query("article", { args: { documentId: "a" }, select: { title: true } });
		if (err) throw new Error(err.message);
		expectTypeOf(data).toEqualTypeOf<{ title: string } | null>();
		expect(data).toBeNull();
	});

	it("runs a mutation the same way", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({ data: { createArticle: { documentId: "a" } } }));
		const [err] = await strapi.mutate("createArticle", { args: { data: { title: "A" } }, select: { documentId: true } });
		expect(err).toBeNull();
		expect(sent().query).toBe("mutation CreateArticle($data: ArticleInput!) { createArticle(data: $data) { documentId } }");
	});

	it("refuses an argument the field does not declare, at the point it would be sent", async () => {
		const [err] = await strapi.query("articles", {
			// A generic constraint cannot reject this one, so the builder does.
			args: { documentId: "a" } as never,
			select: { title: true },
		});
		expect(err?.message).toMatch(/takes no argument named "documentId"/);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("passes fetch options through to the request", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({ data: { articles: [] } }));
		await strapi.query("articles", { select: { documentId: true }, init: { cache: "no-store" } });
		expect(lastCall(fetchMock).init.cache).toBe("no-store");
	});

	it("passes a GraphQL error through as the error tuple", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({ data: null, errors: [{ message: "nope" }] }));
		const [err, data] = await strapi.query("articles", { select: { documentId: true } });
		expect(data).toBeNull();
		expect(err?.message).toBe("nope");
	});

	it("says so when the schema was never registered", async () => {
		const bare = new Strapi({ baseURL: "http://h", defaultLocale: "en" });
		const [err] = await bare.query("articles", { select: { documentId: true } });
		expect(err?.message).toMatch(/graphqlArgs/);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("refuses a selection or argument the schema does not have", () => {
		const rejected = () => {
			// @ts-expect-error nope is not a field of Article
			strapi.query("articles", { select: { nope: true } });
			// @ts-expect-error article needs documentId
			strapi.query("article", { select: { title: true } });
			// @ts-expect-error there is no such query
			strapi.query("nope", { select: { title: true } });
		};
		expect(rejected).toBeTypeOf("function");
	});
});
