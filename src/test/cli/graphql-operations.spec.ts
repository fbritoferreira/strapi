import { describe, expect, it } from "vitest";

import { graphqlModel, gqlTypeName, type IntrospectionSchema } from "../../cli/graphql";

const ref = (json: string) => JSON.parse(json) as never;

describe("gqlTypeName", () => {
	it.each([
		['{"kind":"SCALAR","name":"String"}', "String"],
		['{"kind":"NON_NULL","ofType":{"kind":"SCALAR","name":"ID"}}', "ID!"],
		['{"kind":"LIST","ofType":{"kind":"NON_NULL","ofType":{"kind":"SCALAR","name":"String"}}}', "[String!]"],
		['{"kind":"NON_NULL","ofType":{"kind":"LIST","ofType":{"kind":"INPUT_OBJECT","name":"ArticleFiltersInput"}}}', "[ArticleFiltersInput]!"],
	])("%s → %s", (json, expected) => {
		expect(gqlTypeName(ref(json))).toBe(expected);
	});
});

const schema: IntrospectionSchema = {
	queryType: { name: "Query" },
	mutationType: { name: "Mutation" },
	types: [
		{
			kind: "OBJECT",
			name: "Query",
			fields: [
				{
					name: "articles",
					args: [
						{ name: "filters", type: { kind: "INPUT_OBJECT", name: "ArticleFiltersInput" } },
						{ name: "locale", type: { kind: "SCALAR", name: "I18NLocaleCode" } },
					],
					type: { kind: "NON_NULL", ofType: { kind: "LIST", ofType: { kind: "NON_NULL", ofType: { kind: "OBJECT", name: "Article" } } } },
				},
				{
					name: "article",
					args: [{ name: "documentId", type: { kind: "NON_NULL", ofType: { kind: "SCALAR", name: "ID" } } }],
					type: { kind: "OBJECT", name: "Article" },
				},
			],
		},
		{
			kind: "OBJECT",
			name: "Mutation",
			fields: [
				{
					name: "createArticle",
					args: [{ name: "data", type: { kind: "NON_NULL", ofType: { kind: "INPUT_OBJECT", name: "ArticleInput" } } }],
					type: { kind: "OBJECT", name: "Article" },
				},
			],
		},
		{ kind: "OBJECT", name: "Article", fields: [{ name: "title", type: { kind: "SCALAR", name: "String" } }] },
	],
};

describe("gqlTypeName with incomplete references", () => {
	it.each([
		['{"kind":"NON_NULL"}', "Unknown"],
		['{"kind":"LIST"}', "[Unknown]"],
		['{"kind":"SCALAR"}', "Unknown"],
	])("%s → %s", (json, expected) => {
		expect(gqlTypeName(ref(json))).toBe(expected);
	});
});

describe("graphqlModel operations", () => {
	const model = graphqlModel(schema);

	it("collects the root query fields with their arguments", () => {
		expect(model.queries[0]).toEqual({
			name: "articles",
			args: [
				{ name: "filters", gqlType: "ArticleFiltersInput", tsType: "ArticleFiltersInput | null", required: false },
				{ name: "locale", gqlType: "I18NLocaleCode", tsType: "string | null", required: false },
			],
			result: "Article[]",
			resultType: "Article",
			list: true,
		});
	});

	it("keeps a single-document query separate from the list one", () => {
		expect(model.queries.map((q) => q.name)).toEqual(["articles", "article"]);
		expect(model.queries[1]).toMatchObject({ result: "Article | null", list: false });
	});

	it("marks a required argument as required", () => {
		expect(model.queries[1]?.args[0]).toEqual({ name: "documentId", gqlType: "ID!", tsType: "string", required: true });
		expect(model.mutations[0]?.args[0]).toEqual({ name: "data", gqlType: "ArticleInput!", tsType: "ArticleInput", required: true });
	});

	it("collects mutations separately", () => {
		expect(model.mutations.map((m) => m.name)).toEqual(["createArticle"]);
		expect(model.mutations[0]?.list).toBe(false);
		expect(model.mutations[0]?.result).toBe("Article | null");
	});

	it("leaves the root types out of the emitted types", () => {
		expect(model.types.map((t) => t.name)).toEqual(["Article"]);
	});

	it("names a scalar result by its TypeScript type, and an unnamed one unknown", () => {
		const scalars = graphqlModel({
			queryType: { name: "Query" },
			types: [
				{
					kind: "OBJECT",
					name: "Query",
					fields: [
						{ name: "count", args: [], type: { kind: "SCALAR", name: "Int" } },
						{ name: "mystery", args: [], type: { kind: "SCALAR" } },
					],
				},
			],
		});
		expect(scalars.queries[0]?.resultType).toBe("number");
		expect(scalars.queries[1]?.resultType).toBe("unknown");
	});

	it("falls back to unknown for an unnamed object result", () => {
		const unnamed = graphqlModel({
			queryType: { name: "Query" },
			types: [{ kind: "OBJECT", name: "Query", fields: [{ name: "thing", args: [], type: { kind: "OBJECT" } }] }],
		});
		expect(unnamed.queries[0]?.resultType).toBe("unknown");
	});

	it("takes a root that declares no fields as having none", () => {
		const empty = graphqlModel({ queryType: { name: "Query" }, types: [{ kind: "OBJECT", name: "Query" }] });
		expect(empty.queries).toEqual([]);
	});

	it("handles a root whose fields or args are missing", () => {
		const sparse = graphqlModel({
			queryType: { name: "Query" },
			mutationType: { name: "Missing" },
			types: [{ kind: "OBJECT", name: "Query", fields: [{ name: "ping", type: { kind: "SCALAR", name: "String" } }] }],
		});
		expect(sparse.queries[0]).toMatchObject({ name: "ping", args: [], list: false });
		expect(sparse.mutations).toEqual([]);
	});

	it("takes a field with no arguments as taking none", () => {
		const model = graphqlModel(schema);
		expect(model.queries.every((q) => Array.isArray(q.args))).toBe(true);
	});

	it("has no operations when the schema declares no roots", () => {
		const bare = graphqlModel({ types: [{ kind: "OBJECT", name: "Article", fields: [] }] });
		expect(bare.queries).toEqual([]);
		expect(bare.mutations).toEqual([]);
	});
});
