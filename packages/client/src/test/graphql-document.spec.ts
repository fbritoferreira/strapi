import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import { Strapi } from "../index";
import type { TypedDocument } from "../types";
import { installFetchMock, jsonResponse, lastCall, type FetchMock } from "./helpers";

interface ArticlesData {
	articles: { documentId: string; title: string }[];
}

/** What graphql-codegen emits with `documentMode: "string"`: a String subclass carrying the type marker. */
class TypedDocumentString<TData, TVariables> extends String implements TypedDocument<TData, TVariables> {
	declare readonly __apiType?: (variables: TVariables) => TData;
}

const ArticlesDocument = new TypedDocumentString<ArticlesData, { locale?: string }>(
	"query Articles($locale: I18NLocaleCode) { articles(locale: $locale) { documentId title } }"
);

/** What it emits by default: a TypedDocumentNode, whose AST keeps the source text in `loc`. */
const ArticlesAst = {
	kind: "Document",
	definitions: [],
	loc: { source: { body: "query Articles { articles { documentId title } }" } },
} as unknown as TypedDocument<ArticlesData, Record<string, never>>;

const CreateArticleDocument = {} as TypedDocument<{ createArticle: { documentId: string } }, { data: { title: string } }>;

describe("Strapi.graphql with typed documents", () => {
	let fetchMock: FetchMock;
	const strapi = new Strapi({ baseURL: "http://h", defaultLocale: "en" });

	beforeEach(() => {
		fetchMock = installFetchMock();
	});
	afterEach(() => vi.restoreAllMocks());

	it("infers data and variables from the document", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({ data: { articles: [{ documentId: "a", title: "A" }] } }));
		const [err, data] = await strapi.graphql(ArticlesDocument, { variables: { locale: "fr" } });
		if (err) throw new Error(err.message);
		expectTypeOf(data).toEqualTypeOf<ArticlesData>();
		expect(data.articles[0]?.title).toBe("A");
	});

	it("sends the document's own text", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({ data: { articles: [] } }));
		await strapi.graphql(ArticlesDocument, { variables: { locale: "fr" } });
		expect(JSON.parse(String(lastCall(fetchMock).init.body))).toEqual({
			query: "query Articles($locale: I18NLocaleCode) { articles(locale: $locale) { documentId title } }",
			variables: { locale: "fr" },
		});
	});

	it("reads the source text of a document node", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({ data: { articles: [] } }));
		await strapi.graphql(ArticlesAst);
		expect(JSON.parse(String(lastCall(fetchMock).init.body)).query).toBe("query Articles { articles { documentId title } }");
	});

	it("rejects a document it cannot serialize, without throwing", async () => {
		const opaque = { kind: "Document", definitions: [] } as unknown as TypedDocument<ArticlesData, Record<string, never>>;
		const [err, data] = await strapi.graphql(opaque);
		expect(data).toBeNull();
		expect(err?.message).toMatch(/documentMode/);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("still takes a plain string with explicit type arguments", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({ data: { articles: [] } }));
		const [err, data] = await strapi.graphql<ArticlesData>("{ articles { documentId title } }");
		if (err) throw new Error(err.message);
		expectTypeOf(data).toEqualTypeOf<ArticlesData>();
	});

	it("requires variables the document declares as required", () => {
		const rejected = () => {
			// @ts-expect-error this document needs variables.data
			strapi.graphql(CreateArticleDocument);
			// @ts-expect-error title must be a string
			strapi.graphql(CreateArticleDocument, { variables: { data: { title: 1 } } });
		};
		expect(rejected).toBeTypeOf("function");
	});

	it("leaves variables optional when the document has none required", () => {
		const accepted = () => {
			strapi.graphql(ArticlesDocument);
			strapi.graphql(ArticlesAst);
		};
		expect(accepted).toBeTypeOf("function");
	});
});
