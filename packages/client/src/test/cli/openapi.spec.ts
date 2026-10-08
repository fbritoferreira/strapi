import { describe, expect, it } from "vitest";

import { collectRoutes, routesModel, tsTypeOf, type OpenApiDocument } from "../../cli/openapi";

const names = new Map([["PluginUploadFileDocument", "PluginUploadFile"]]);

describe("tsTypeOf", () => {
	it.each([
		[{ type: "string" }, "string"],
		[{ type: "integer" }, "number"],
		[{ type: "number" }, "number"],
		[{ type: "boolean" }, "boolean"],
		[{ type: "null" }, "null"],
		[{}, "unknown"],
		[{ type: "string", enum: ["a", "b"] }, '"a" | "b"'],
		[{ type: "string", const: "*" }, '"*"'],
		[{ type: "array", items: { type: "string" } }, "string[]"],
		[{ type: "array", items: {} }, "unknown[]"],
		[{ type: "array" }, "unknown[]"],
		[{ type: "file" }, "unknown"],
		[{ enum: [] }, "unknown"],
		[{ type: ["string", "null"] }, "string | null"],
		[{ type: ["string", "weird"] }, "string | unknown"],
		[{ type: "array", items: { anyOf: [{ type: "string" }, { type: "null" }] } }, "(string | null)[]"],
		[{ type: "array", items: { allOf: [{ type: "object", properties: { a: { type: "string" } }, required: ["a"] }, { type: "object", properties: { b: { type: "number" } } }] } }, "({ a: string } & { b?: number })[]"],
		[{ properties: { a: { type: "string" } }, required: ["a"] }, "{ a: string }"],
		[{ $ref: "#/components/schemas/PluginUploadFileDocument" }, "PluginUploadFile"],
		[{ anyOf: [{ type: "string" }, { type: "null" }] }, "string | null"],
		[{ oneOf: [{ type: "string" }, { type: "number" }] }, "string | number"],
		[{ allOf: [{ type: "object", properties: { a: { type: "string" } }, required: ["a"] }, { type: "object", properties: { b: { type: "number" } } }] }, "{ a: string } & { b?: number }"],
	])("%o → %s", (schema, expected) => {
		expect(tsTypeOf(schema, names)).toBe(expected);
	});

	it("renders objects with optional and quoted keys", () => {
		const schema = {
			type: "object",
			properties: { jwt: { type: "string" }, "provider-id": { type: "number" } },
			required: ["jwt"],
		};
		expect(tsTypeOf(schema, names)).toBe('{ jwt: string; "provider-id"?: number }');
	});

	it("falls back to an index signature for a free-form object", () => {
		expect(tsTypeOf({ type: "object" }, names)).toBe("Record<string, unknown>");
	});

	it("names an unknown $ref target unknown", () => {
		expect(tsTypeOf({ $ref: "#/components/schemas/Missing" }, names)).toBe("unknown");
	});
});

const doc: OpenApiDocument = {
	openapi: "3.1.0",
	info: { title: "t", version: "1" },
	paths: {
		"/articles": {
			get: {
				parameters: [
					{ name: "sort", in: "query", schema: { type: "string" } },
					{ name: "pagination", in: "query", required: true, schema: { type: "object", properties: { page: { type: "number" } } } },
				],
				responses: { "200": { content: { "application/json": { schema: { type: "object", properties: { data: { type: "array", items: { type: "object", properties: { title: { type: "string" } }, required: ["title"] } } }, required: ["data"] } } } } },
			},
			post: {
				requestBody: { content: { "application/json": { schema: { type: "object", properties: { data: { type: "object" } }, required: ["data"] } } } },
				responses: { "200": { content: { "application/json": { schema: { type: "object" } } } } },
			},
		},
		"/articles/{id}": {
			get: {
				parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
				responses: { "200": { content: { "application/json": { schema: { type: "object" } } } } },
			},
		},
		"/connect/(.*)": { get: { responses: { "200": { description: "OK" } } } },
	},
};

describe("collectRoutes", () => {
	it("keys routes by method and path", () => {
		expect(collectRoutes(doc, names).map((r) => r.key)).toEqual([
			"GET /articles",
			"POST /articles",
			"GET /articles/{id}",
		]);
	});

	it("handles a document with no paths at all", () => {
		expect(collectRoutes({ openapi: "3.1.0", info: { title: "t", version: "1" } } as OpenApiDocument, names)).toEqual([]);
	});

	it("skips paths that are not literal routes", () => {
		expect(collectRoutes(doc, names).some((r) => r.key.includes("(.*)"))).toBe(false);
	});

	it("types query params, keeping required ones required", () => {
		const route = collectRoutes(doc, names)[0];
		expect(route?.query).toBe("{ sort?: string; pagination: { page?: number } }");
	});

	it("types path params", () => {
		const route = collectRoutes(doc, names).find((r) => r.key === "GET /articles/{id}");
		expect(route?.pathParams).toBe("{ id: string }");
	});

	it("types the request body and the 200 response", () => {
		const route = collectRoutes(doc, names).find((r) => r.key === "POST /articles");
		expect(route?.body).toBe("{ data: Record<string, unknown> }");
		expect(route?.response).toBe("Record<string, unknown>");
	});

	it("leaves body and query undefined when the route declares none", () => {
		const route = collectRoutes(doc, names).find((r) => r.key === "GET /articles/{id}");
		expect(route?.body).toBeUndefined();
		expect(route?.query).toBeUndefined();
	});

	it("types a parameter that declares no schema as unknown", () => {
		const bare: OpenApiDocument = {
			...doc,
			paths: { "/ping": { get: { parameters: [{ name: "trace", in: "query" }], responses: {} } } },
		};
		expect(collectRoutes(bare, names)[0]?.query).toBe("{ trace?: unknown }");
	});

	it("falls back to the 201 response when there is no 200", () => {
		const created: OpenApiDocument = {
			...doc,
			paths: {
				"/things": {
					post: { responses: { "201": { content: { "application/json": { schema: { type: "object", properties: { id: { type: "number" } }, required: ["id"] } } } } } },
				},
			},
		};
		expect(collectRoutes(created, names)[0]?.response).toBe("{ id: number }");
	});

	it("types a response with no JSON content as unknown", () => {
		const bare: OpenApiDocument = { ...doc, paths: { "/ping": { get: { responses: { "200": { description: "OK" } } } } } };
		expect(collectRoutes(bare, names)[0]?.response).toBe("unknown");
	});
});

describe("routesModel", () => {
	const withSchemas: OpenApiDocument = {
		...doc,
		components: {
			schemas: {
				"plugin-upload-file": { type: "object", properties: { url: { type: "string" } }, required: ["url"] },
				Role: { type: "object", properties: { name: { type: "string" } } },
			},
		},
	};

	it("names every component schema and renders it", () => {
		expect(routesModel(withSchemas).schemas).toEqual([
			{ name: "PluginUploadFile", type: "{ url: string }" },
			{ name: "Role", type: "{ name?: string }" },
		]);
	});

	it("resolves refs between component schemas by their generated names", () => {
		const model = routesModel({
			...doc,
			components: { schemas: { Role: { type: "object", properties: { file: { $ref: "#/components/schemas/plugin-upload-file" } } }, "plugin-upload-file": { type: "object", properties: { url: { type: "string" } } } } },
		});
		expect(model.schemas[0]).toEqual({ name: "Role", type: "{ file?: PluginUploadFile }" });
	});

	it("collects the routes alongside the schemas", () => {
		expect(routesModel(withSchemas).routes.map((r) => r.key)).toEqual(["GET /articles", "POST /articles", "GET /articles/{id}"]);
	});

	it("handles a document with no components", () => {
		expect(routesModel(doc).schemas).toEqual([]);
	});
});
