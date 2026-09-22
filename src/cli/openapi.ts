/** Minimal OpenAPI 3.1 reader: enough of the document to type routes, nothing more. */

import { pascalCase } from "./normalize";

/** JSON Schema subset Strapi emits for params, bodies and responses. */
export interface JsonSchema {
	type?: string | string[];
	enum?: unknown[];
	const?: unknown;
	items?: JsonSchema;
	properties?: Record<string, JsonSchema>;
	required?: string[];
	anyOf?: JsonSchema[];
	oneOf?: JsonSchema[];
	allOf?: JsonSchema[];
	$ref?: string;
}

/** One entry of an operation's `parameters`. */
export interface OpenApiParameter {
	name: string;
	in: string;
	required?: boolean;
	schema?: JsonSchema;
}

/** Media-type map of a request body or response. */
type Content = Record<string, { schema?: JsonSchema }>;

/** One operation of a path item. */
export interface OpenApiOperation {
	operationId?: string;
	parameters?: OpenApiParameter[];
	requestBody?: { content?: Content };
	responses?: Record<string, { description?: string; content?: Content }>;
}

/** The parts of an OpenAPI document this generator reads. */
export interface OpenApiDocument {
	openapi: string;
	info: { title: string; version: string };
	paths: Record<string, Record<string, OpenApiOperation>>;
	components?: { schemas?: Record<string, JsonSchema> };
}

/** One route, with every part already rendered as a TypeScript type. */
export interface RouteModel {
	/** `"GET /articles"`, the key of the emitted registry. */
	key: string;
	method: string;
	path: string;
	pathParams?: string;
	query?: string;
	body?: string;
	response: string;
}

/** Component schemas rendered as named types, plus the routes that use them. */
export interface RoutesModel {
	schemas: { name: string; type: string }[];
	routes: RouteModel[];
}

const METHODS = ["get", "post", "put", "patch", "delete"];
/** Paths made only of literal segments and `{param}` placeholders. */
const LITERAL_PATH = /^\/[A-Za-z0-9\-._~/]*(?:\{[A-Za-z0-9_]+\}[A-Za-z0-9\-._~/]*)*$/;
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

const PRIMITIVES: Record<string, string> = {
	string: "string",
	number: "number",
	integer: "number",
	boolean: "boolean",
	null: "null",
};

function propertyName(name: string): string {
	return IDENTIFIER.test(name) ? name : JSON.stringify(name);
}

function union(members: string[]): string {
	const unique = [...new Set(members)];
	return unique.length === 0 ? "unknown" : unique.join(" | ");
}

/** Wraps a composite type so it reads correctly as an array element. */
function element(type: string): string {
	return type.includes(" | ") || type.includes(" & ") ? `(${type})` : type;
}

function objectType(schema: JsonSchema, names: Map<string, string>): string {
	const properties = schema.properties ?? {};
	const entries = Object.entries(properties);
	if (entries.length === 0) return "Record<string, unknown>";
	const required = new Set(schema.required ?? []);
	const members = entries.map(([name, property]) => {
		const optional = required.has(name) ? "" : "?";
		return `${propertyName(name)}${optional}: ${tsTypeOf(property, names)}`;
	});
	return `{ ${members.join("; ")} }`;
}

/**
 * Renders one JSON Schema as a TypeScript type. `names` maps a
 * `components.schemas` key to the interface name emitted for it; a `$ref` to
 * anything else becomes `unknown` rather than a dangling identifier.
 */
export function tsTypeOf(schema: JsonSchema, names: Map<string, string>): string {
	if (schema.$ref !== undefined) {
		const key = schema.$ref.slice(schema.$ref.lastIndexOf("/") + 1);
		return names.get(key) ?? "unknown";
	}
	if (schema.const !== undefined) return JSON.stringify(schema.const);
	if (schema.enum !== undefined) return union(schema.enum.map((value) => JSON.stringify(value)));
	if (schema.allOf !== undefined) return schema.allOf.map((part) => element(tsTypeOf(part, names))).join(" & ");
	if (schema.anyOf !== undefined) return union(schema.anyOf.map((part) => tsTypeOf(part, names)));
	if (schema.oneOf !== undefined) return union(schema.oneOf.map((part) => tsTypeOf(part, names)));
	if (Array.isArray(schema.type)) return union(schema.type.map((type) => PRIMITIVES[type] ?? "unknown"));
	if (schema.type === "array") {
		return `${element(schema.items === undefined ? "unknown" : tsTypeOf(schema.items, names))}[]`;
	}
	if (schema.type === "object") return objectType(schema, names);
	if (schema.type !== undefined) return PRIMITIVES[schema.type] ?? "unknown";
	return schema.properties === undefined ? "unknown" : objectType(schema, names);
}

function paramsType(parameters: OpenApiParameter[], where: string, names: Map<string, string>): string | undefined {
	const matching = parameters.filter((parameter) => parameter.in === where);
	if (matching.length === 0) return undefined;
	const members = matching.map((parameter) => {
		const optional = parameter.required === true ? "" : "?";
		const type = parameter.schema === undefined ? "unknown" : tsTypeOf(parameter.schema, names);
		return `${propertyName(parameter.name)}${optional}: ${type}`;
	});
	return `{ ${members.join("; ")} }`;
}

function jsonSchemaOf(content: Content | undefined): JsonSchema | undefined {
	return content?.["application/json"]?.schema;
}

/**
 * Turns the document's paths into one {@link RouteModel} per operation.
 *
 * Paths Strapi writes as raw regexes (`/connect/(.*)`) are skipped: they cannot
 * be called by name, so a registry key for them would be a lie.
 */
export function collectRoutes(document: OpenApiDocument, names: Map<string, string>): RouteModel[] {
	const routes: RouteModel[] = [];
	for (const [path, item] of Object.entries(document.paths ?? {})) {
		if (!LITERAL_PATH.test(path)) continue;
		for (const method of METHODS) {
			const operation = item[method];
			if (operation === undefined) continue;
			const parameters = operation.parameters ?? [];
			const success = operation.responses?.["200"] ?? operation.responses?.["201"];
			const responseSchema = jsonSchemaOf(success?.content);
			const bodySchema = jsonSchemaOf(operation.requestBody?.content);
			const pathParams = paramsType(parameters, "path", names);
			const query = paramsType(parameters, "query", names);
			routes.push({
				key: `${method.toUpperCase()} ${path}`,
				method: method.toUpperCase(),
				path,
				...(pathParams !== undefined && { pathParams }),
				...(query !== undefined && { query }),
				...(bodySchema !== undefined && { body: tsTypeOf(bodySchema, names) }),
				response: responseSchema === undefined ? "unknown" : tsTypeOf(responseSchema, names),
			});
		}
	}
	return routes;
}

/**
 * Turns a document into everything the emitter needs: every
 * `components.schemas` entry under a TypeScript-safe name, and every route.
 */
export function routesModel(document: OpenApiDocument): RoutesModel {
	const schemas = document.components?.schemas ?? {};
	const names = new Map(Object.keys(schemas).map((key) => [key, pascalCase(key)]));
	return {
		schemas: Object.entries(schemas).map(([key, schema]) => ({
			name: pascalCase(key),
			type: tsTypeOf(schema, names),
		})),
		routes: collectRoutes(document, names),
	};
}
