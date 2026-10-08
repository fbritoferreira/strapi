/** Minimal GraphQL introspection reader: schema types in, TypeScript out. */

/** A type reference, wrapped in `NON_NULL` and `LIST` the way introspection returns it. */
export interface TypeRef {
	kind: string;
	name?: string | null;
	ofType?: TypeRef | null;
}

/** One argument of a root field. */
export interface IntrospectionArg {
	name: string;
	type: TypeRef;
}

/** One field of an object, interface or input type. */
export interface IntrospectionField {
	name: string;
	type: TypeRef;
	args?: IntrospectionArg[] | null;
}

/** One entry of `__schema.types`. */
export interface IntrospectionType {
	kind: string;
	name: string;
	fields?: IntrospectionField[] | null;
	inputFields?: IntrospectionField[] | null;
	enumValues?: { name: string }[] | null;
	possibleTypes?: TypeRef[] | null;
}

/** The introspection result this generator reads. */
export interface IntrospectionSchema {
	queryType?: { name: string } | null;
	mutationType?: { name: string } | null;
	types: IntrospectionType[];
}

/** One argument of a root operation, in both languages. */
export interface OperationArg {
	name: string;
	/** How GraphQL spells the type, for the variable declaration: `ArticleFiltersInput`, `ID!`. */
	gqlType: string;
	/** How TypeScript spells it, for the generated registry. */
	tsType: string;
	required: boolean;
}

/** One root field: what it takes, and what it answers with. */
export interface Operation {
	name: string;
	args: OperationArg[];
	/** Result as TypeScript: `Article[]`, `Article | null`. */
	result: string;
	/** The named type inside that result, which a selection picks from. */
	resultType: string;
	list: boolean;
}

/** One schema type rendered as TypeScript. */
export interface GraphqlTypeDecl {
	name: string;
	kind: string;
	type: string;
}

/** Everything the emitter needs from a schema. */
export interface GraphqlModel {
	types: GraphqlTypeDecl[];
	queries: Operation[];
	mutations: Operation[];
	queryType?: string;
	mutationType?: string;
}

/** GraphQL scalars Strapi ships, mapped to what its JSON serialisation gives you. */
const SCALARS: Record<string, string> = {
	ID: "string",
	String: "string",
	Int: "number",
	Float: "number",
	Boolean: "boolean",
	Date: "string",
	DateTime: "string",
	Time: "string",
	JSON: "unknown",
	Long: "number",
	I18NLocaleCode: "string",
	Upload: "unknown",
};

const EMITTED_KINDS = new Set(["OBJECT", "INTERFACE", "ENUM", "INPUT_OBJECT", "UNION"]);

function scalar(name: string | null | undefined): string {
	return name === null || name === undefined ? "unknown" : (SCALARS[name] ?? "unknown");
}

/** Wraps a union so it reads correctly as an array element. */
function element(type: string): string {
	return type.includes(" | ") ? `(${type})` : type;
}

/**
 * Spells a type reference the way GraphQL does, for a variable declaration.
 */
export function gqlTypeName(ref: TypeRef): string {
	if (ref.kind === "NON_NULL") {
		return ref.ofType === undefined || ref.ofType === null ? "Unknown" : `${gqlTypeName(ref.ofType)}!`;
	}
	if (ref.kind === "LIST") {
		return ref.ofType === undefined || ref.ofType === null ? "[Unknown]" : `[${gqlTypeName(ref.ofType)}]`;
	}
	return ref.name ?? "Unknown";
}

/** The named type inside a reference, past any list and non-null wrappers. */
function namedTypeOf(ref: TypeRef): string {
	if (ref.ofType !== undefined && ref.ofType !== null) return namedTypeOf(ref.ofType);
	if (ref.kind === "SCALAR") return scalar(ref.name);
	return ref.name ?? "unknown";
}

function isList(ref: TypeRef): boolean {
	if (ref.kind === "LIST") return true;
	return ref.ofType === undefined || ref.ofType === null ? false : isList(ref.ofType);
}

/** Turns a root object's fields into operations. */
function operationsOf(schema: IntrospectionSchema, rootName: string | undefined): Operation[] {
	if (rootName === undefined) return [];
	const root = schema.types.find((type) => type.name === rootName);
	if (root === undefined) return [];
	return (root.fields ?? []).map((field) => ({
		name: field.name,
		args: (field.args ?? []).map((arg) => ({
			name: arg.name,
			gqlType: gqlTypeName(arg.type),
			tsType: tsTypeOfRef(arg.type),
			required: arg.type.kind === "NON_NULL",
		})),
		result: tsTypeOfRef(field.type),
		resultType: namedTypeOf(field.type),
		list: isList(field.type),
	}));
}

/** Renders a type reference, adding `| null` wherever the schema allows null. */
export function tsTypeOfRef(ref: TypeRef): string {
	if (ref.kind === "NON_NULL") {
		return ref.ofType === undefined || ref.ofType === null ? "unknown" : nonNull(ref.ofType);
	}
	return `${nonNull(ref)} | null`;
}

/** Renders a reference that is already known to be non-null at this level. */
function nonNull(ref: TypeRef): string {
	if (ref.kind === "LIST") {
		return ref.ofType === undefined || ref.ofType === null ? "unknown[]" : `${element(tsTypeOfRef(ref.ofType))}[]`;
	}
	if (ref.kind === "NON_NULL") {
		return ref.ofType === undefined || ref.ofType === null ? "unknown" : nonNull(ref.ofType);
	}
	if (ref.kind === "SCALAR") return scalar(ref.name);
	return ref.name ?? "unknown";
}

function fieldsType(fields: IntrospectionField[], optional: boolean): string {
	if (fields.length === 0) return "Record<string, never>";
	// A nullable output field is still present in the response, just null; a
	// nullable input field may be left out entirely.
	const members = fields.map((field) => `\t${field.name}${optional ? "?" : ""}: ${tsTypeOfRef(field.type)};`);
	return `{\n${members.join("\n")}\n}`;
}

function declare(type: IntrospectionType): GraphqlTypeDecl | null {
	if (!EMITTED_KINDS.has(type.kind)) return null;
	if (type.name.startsWith("__")) return null;
	if (type.kind === "ENUM") {
		const values = type.enumValues ?? [];
		return { name: type.name, kind: type.kind, type: values.length === 0 ? "never" : values.map((v) => JSON.stringify(v.name)).join(" | ") };
	}
	if (type.kind === "UNION") {
		const members = type.possibleTypes ?? [];
		return { name: type.name, kind: type.kind, type: members.length === 0 ? "never" : members.map((member) => nonNull(member)).join(" | ") };
	}
	if (type.kind === "INPUT_OBJECT") {
		return { name: type.name, kind: type.kind, type: fieldsType(type.inputFields ?? [], true) };
	}
	return { name: type.name, kind: type.kind, type: fieldsType(type.fields ?? [], false) };
}

/** Turns an introspection result into the types to emit. */
export function graphqlModel(schema: IntrospectionSchema): GraphqlModel {
	const queryType = schema.queryType?.name;
	const mutationType = schema.mutationType?.name;
	const roots = new Set([queryType, mutationType].filter((name): name is string => name !== undefined));

	const types: GraphqlTypeDecl[] = [];
	for (const type of schema.types) {
		// The roots become operations rather than types: nobody selects a `Query`.
		if (roots.has(type.name)) continue;
		const declaration = declare(type);
		if (declaration !== null) types.push(declaration);
	}

	return {
		types,
		queries: operationsOf(schema, queryType),
		mutations: operationsOf(schema, mutationType),
		...(queryType !== undefined && { queryType }),
		...(mutationType !== undefined && { mutationType }),
	};
}
