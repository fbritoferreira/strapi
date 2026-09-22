import { describe, expect, it } from "vitest";

import { graphqlModel, tsTypeOfRef, type IntrospectionSchema, type TypeRef } from "../../cli/graphql";

const ref = (json: string): TypeRef => JSON.parse(json) as TypeRef;

describe("tsTypeOfRef", () => {
	it.each([
		['{"kind":"SCALAR","name":"String"}', "string | null"],
		['{"kind":"NON_NULL","ofType":{"kind":"SCALAR","name":"String"}}', "string"],
		['{"kind":"NON_NULL","ofType":{"kind":"SCALAR","name":"Int"}}', "number"],
		['{"kind":"NON_NULL","ofType":{"kind":"SCALAR","name":"Boolean"}}', "boolean"],
		['{"kind":"NON_NULL","ofType":{"kind":"SCALAR","name":"ID"}}', "string"],
		['{"kind":"NON_NULL","ofType":{"kind":"SCALAR","name":"DateTime"}}', "string"],
		['{"kind":"NON_NULL","ofType":{"kind":"SCALAR","name":"JSON"}}', "unknown"],
		['{"kind":"NON_NULL","ofType":{"kind":"SCALAR","name":"Mystery"}}', "unknown"],
		['{"kind":"NON_NULL","ofType":{"kind":"OBJECT","name":"Article"}}', "Article"],
		['{"kind":"LIST","ofType":{"kind":"NON_NULL","ofType":{"kind":"OBJECT","name":"Article"}}}', "Article[] | null"],
		['{"kind":"NON_NULL","ofType":{"kind":"LIST","ofType":{"kind":"SCALAR","name":"String"}}}', "(string | null)[]"],
	])("%s → %s", (json, expected) => {
		expect(tsTypeOfRef(ref(json))).toBe(expected);
	});
});

const schema: IntrospectionSchema = {
	queryType: { name: "Query" },
	types: [
		{
			kind: "OBJECT",
			name: "Article",
			fields: [
				{ name: "documentId", type: { kind: "NON_NULL", ofType: { kind: "SCALAR", name: "ID" } } },
				{ name: "title", type: { kind: "SCALAR", name: "String" } },
			],
		},
		{
			kind: "ENUM",
			name: "PublicationStatus",
			enumValues: [{ name: "DRAFT" }, { name: "PUBLISHED" }],
		},
		{
			kind: "INPUT_OBJECT",
			name: "ArticleFiltersInput",
			inputFields: [{ name: "title", type: { kind: "INPUT_OBJECT", name: "StringFilterInput" } }],
		},
		{ kind: "UNION", name: "GenericMorph", possibleTypes: [{ kind: "OBJECT", name: "Article" }] },
		{ kind: "SCALAR", name: "DateTime" },
		{ kind: "OBJECT", name: "__Schema", fields: [] },
	],
};

describe("tsTypeOfRef with incomplete references", () => {
	it.each([
		['{"kind":"NON_NULL"}', "unknown"],
		['{"kind":"NON_NULL","ofType":{"kind":"NON_NULL","ofType":{"kind":"SCALAR","name":"String"}}}', "string"],
		['{"kind":"LIST"}', "unknown[] | null"],
		['{"kind":"SCALAR"}', "unknown | null"],
		['{"kind":"OBJECT"}', "unknown | null"],
	])("%s → %s", (json, expected) => {
		expect(tsTypeOfRef(ref(json))).toBe(expected);
	});
});

describe("graphqlModel edge cases", () => {
	const model = (types: IntrospectionSchema["types"]) => graphqlModel({ types });

	it("renders an interface like an object", () => {
		expect(model([{ kind: "INTERFACE", name: "Node", fields: [{ name: "id", type: { kind: "NON_NULL", ofType: { kind: "SCALAR", name: "ID" } } }] }]).types[0]).toEqual({
			name: "Node",
			kind: "INTERFACE",
			type: "{\n\tid: string;\n}",
		});
	});

	it("renders a type with no fields as an empty record", () => {
		expect(model([{ kind: "OBJECT", name: "Empty", fields: [] }]).types[0]?.type).toBe("Record<string, never>");
		expect(model([{ kind: "OBJECT", name: "Empty" }]).types[0]?.type).toBe("Record<string, never>");
	});

	it("renders an enum or union with no members as never", () => {
		expect(model([{ kind: "ENUM", name: "Empty", enumValues: [] }]).types[0]?.type).toBe("never");
		expect(model([{ kind: "UNION", name: "Empty" }]).types[0]?.type).toBe("never");
	});

	it("renders an input object with no fields", () => {
		expect(model([{ kind: "INPUT_OBJECT", name: "Empty" }]).types[0]?.type).toBe("Record<string, never>");
	});

	it("names the mutation type when the schema has one", () => {
		expect(graphqlModel({ types: [], mutationType: { name: "Mutation" } }).mutationType).toBe("Mutation");
	});
});

describe("graphqlModel", () => {
	const model = graphqlModel(schema);

	it("skips introspection types and bare scalars", () => {
		expect(model.types.map((t) => t.name)).toEqual(["Article", "PublicationStatus", "ArticleFiltersInput", "GenericMorph"]);
	});

	it("renders an object type with nullability from the schema", () => {
		expect(model.types[0]).toEqual({
			name: "Article",
			kind: "OBJECT",
			type: "{\n\tdocumentId: string;\n\ttitle: string | null;\n}",
		});
	});

	it("renders an enum as a union of its values", () => {
		expect(model.types[1]?.type).toBe('"DRAFT" | "PUBLISHED"');
	});

	it("renders input fields as optional", () => {
		expect(model.types[2]?.type).toBe("{\n\ttitle?: StringFilterInput | null;\n}");
	});

	it("renders a union of its possible types", () => {
		expect(model.types[3]?.type).toBe("Article");
	});

	it("names the root operation types it found", () => {
		expect(model.queryType).toBe("Query");
		expect(model.mutationType).toBeUndefined();
	});
})
