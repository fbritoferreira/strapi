/** Minimal GraphQL introspection reader: schema types in, TypeScript out. */

/** A type reference, wrapped in `NON_NULL` and `LIST` the way introspection returns it. */
export interface TypeRef {
	kind: string;
	name?: string | null;
	ofType?: TypeRef | null;
}

/** One field of an object, interface or input type. */
export interface IntrospectionField {
	name: string;
	type: TypeRef;
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

/** One schema type rendered as TypeScript. */
export interface GraphqlTypeDecl {
	name: string;
	kind: string;
	type: string;
}

/** Everything the emitter needs from a schema. */
export interface GraphqlModel {
	types: GraphqlTypeDecl[];
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
	const types: GraphqlTypeDecl[] = [];
	for (const type of schema.types) {
		const declaration = declare(type);
		if (declaration !== null) types.push(declaration);
	}
	const queryType = schema.queryType?.name;
	const mutationType = schema.mutationType?.name;
	return {
		types,
		...(queryType !== undefined && { queryType }),
		...(mutationType !== undefined && { mutationType }),
	};
}
