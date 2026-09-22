import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import { Strapi } from "../index";
import { installFetchMock, jsonResponse, lastCall, type FetchMock } from "./helpers";

interface ArticlesData {
	articles: { documentId: string; title: string }[];
}

describe("Strapi.graphql", () => {
	let fetchMock: FetchMock;

	beforeEach(() => {
		fetchMock = installFetchMock();
	});
	afterEach(() => vi.restoreAllMocks());

	const strapi = new Strapi({ baseURL: "http://h", defaultLocale: "en", token: "tok" });

	it("posts the query to /graphql at the origin, not under /api", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({ data: { articles: [] } }));
		await strapi.graphql<ArticlesData>("{ articles { documentId } }");
		expect(lastCall(fetchMock).url).toBe("http://h/graphql");
		expect(lastCall(fetchMock).init.method).toBe("POST");
		expect(new Headers(lastCall(fetchMock).init.headers).get("authorization")).toBe("Bearer tok");
	});

	it("sends query, variables and operation name", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({ data: { articles: [] } }));
		await strapi.graphql<ArticlesData, { locale: string }>("query Articles($locale: I18NLocaleCode) { articles { title } }", {
			variables: { locale: "fr" },
			operationName: "Articles",
		});
		expect(JSON.parse(String(lastCall(fetchMock).init.body))).toEqual({
			query: "query Articles($locale: I18NLocaleCode) { articles { title } }",
			variables: { locale: "fr" },
			operationName: "Articles",
		});
	});

	it("returns the data typed", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({ data: { articles: [{ documentId: "a", title: "A" }] } }));
		const [err, data] = await strapi.graphql<ArticlesData>("{ articles { documentId title } }");
		if (err) throw new Error(err.message);
		expect(data).toEqual({ articles: [{ documentId: "a", title: "A" }] });
		expectTypeOf(data).toEqualTypeOf<ArticlesData>();
	});

	it("turns GraphQL errors into the error tuple", async () => {
		fetchMock.mockResolvedValueOnce(
			jsonResponse({ data: null, errors: [{ message: "Cannot query field \"nope\"", extensions: { code: "GRAPHQL_VALIDATION_FAILED" } }] })
		);
		const [err, data] = await strapi.graphql("{ nope }");
		expect(data).toBeNull();
		expect(err?.name).toBe("GRAPHQL_VALIDATION_FAILED");
		expect(err?.message).toBe('Cannot query field "nope"');
		expect(err?.details).toEqual([{ message: 'Cannot query field "nope"', extensions: { code: "GRAPHQL_VALIDATION_FAILED" } }]);
	});

	it("joins several GraphQL errors into one message", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({ data: null, errors: [{ message: "one" }, { message: "two" }] }));
		const [err] = await strapi.graphql("{ nope }");
		expect(err?.message).toBe("one; two");
		expect(err?.name).toBe("GraphQLError");
	});

	it("reports a missing plugin as an error tuple", async () => {
		fetchMock.mockResolvedValueOnce(new Response("Not Found", { status: 404 }));
		const [err] = await strapi.graphql("{ articles { title } }");
		expect(err?.status).toBe(404);
		expect(err?.message).toMatch(/graphql/i);
	});

	it("fails when the endpoint answers without a data field", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({}));
		const [err] = await strapi.graphql("{ articles { title } }");
		expect(err?.name).toBe("GraphQLError");
		expect(err?.message).toMatch(/no data/i);
	});

	it("passes other HTTP errors through untouched", async () => {
		fetchMock.mockResolvedValueOnce(new Response("boom", { status: 500 }));
		const [err] = await strapi.graphql("{ articles { title } }");
		expect(err?.status).toBe(500);
		expect(err?.message).not.toMatch(/plugin-graphql/);
	});

	it("fails when the endpoint answers an empty body", async () => {
		fetchMock.mockResolvedValueOnce(new Response("", { status: 200 }));
		const [err] = await strapi.graphql("{ articles { title } }");
		expect(err?.message).toMatch(/no data/i);
	});

	it("fails when data is null next to no errors", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({ data: null }));
		const [err] = await strapi.graphql("{ articles { title } }");
		expect(err?.message).toMatch(/no data/i);
	});

	it("takes a custom endpoint from the config", async () => {
		const custom = new Strapi({ baseURL: "http://h/api", defaultLocale: "en", graphqlEndpoint: "/api/graphql" });
		fetchMock.mockResolvedValueOnce(jsonResponse({ data: {} }));
		await custom.graphql("{ articles { title } }");
		expect(lastCall(fetchMock).url).toBe("http://h/api/graphql");
	});
});
