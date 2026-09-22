import { isApiUid, isLocalized, MEDIA_UID, USER_UID, type RawAttribute, type SchemaSet } from "./schema";

export interface NormalizeOptions {
	includePlugins: boolean;
}

export interface Field {
	name: string;
	tsType: string;
	optional: boolean;
	/** Strapi populates this field on request: a relation, component, media or dynamic zone. */
	populatable: boolean;
	doc?: string;
}

export interface TypeDecl {
	name: string;
	kind: "collection" | "single" | "component";
	uid: string;
	localized: boolean;
	fields: Field[];
	doc: string;
}

export interface Model {
	types: TypeDecl[];
	collections: { key: string; typeName: string }[];
	singles: { key: string; typeName: string }[];
	usesMedia: boolean;
	usesUser: boolean;
	usesBlocks: boolean;
}

const STRING_TYPES = new Set(["string", "text", "richtext", "email", "password", "uid", "date", "time", "datetime", "timestamp"]);
const NUMBER_TYPES = new Set(["integer", "float", "decimal"]);
const POPULATED_TYPES = new Set(["relation", "media", "component", "dynamiczone"]);

export function pascalCase(input: string): string {
	const words = input.split(/[^A-Za-z0-9]+|(?<=[a-z0-9])(?=[A-Z])/).filter((w) => w.length > 0);
	const joined = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("");
	return /^[0-9]/.test(joined) ? `_${joined}` : joined;
}

interface Names {
	contentTypes: Map<string, string>; // uid → type name (emitted ones only)
	components: Map<string, string>; // uid → type name
}

function mustGet(map: Map<string, string>, uid: string): string {
	const name = map.get(uid);
	if (name === undefined) {
		throw new Error(`No name assigned for ${uid} (unreachable: assignNames should have registered every uid)`);
	}
	return name;
}

function componentName(uid: string): string {
	const dot = uid.indexOf(".");
	const category = dot === -1 ? "" : uid.slice(0, dot);
	const api = dot === -1 ? uid : uid.slice(dot + 1);
	return pascalCase(category) + pascalCase(api);
}

function isEmitted(uid: string, includePlugins: boolean): boolean {
	if (uid === MEDIA_UID || uid === USER_UID) return false;
	return isApiUid(uid) || (includePlugins && uid.startsWith("plugin::"));
}

const USABLE_NAME = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function assertUsableName(name: string, uid: string): void {
	if (!USABLE_NAME.test(name)) {
		throw new Error(`Cannot derive a TypeScript type name for ${uid} (got "${name}")`);
	}
}

function assignNames(set: SchemaSet, options: NormalizeOptions): Names {
	const taken = new Map<string, string>(); // name → uid
	const claim = (name: string, uid: string): void => {
		const other = taken.get(name);
		if (other !== undefined) {
			throw new Error(`Type name collision: ${other} and ${uid} both map to "${name}"; rename one of them`);
		}
		taken.set(name, uid);
	};
	const components = new Map<string, string>();
	for (const [uid] of set.components) {
		const name = componentName(uid);
		assertUsableName(name, uid);
		claim(name, uid);
		components.set(uid, name);
	}
	const contentTypes = new Map<string, string>();
	for (const [uid, entry] of set.contentTypes) {
		if (!isEmitted(uid, options.includePlugins)) continue;
		const name = pascalCase(entry.schema.info.singularName);
		assertUsableName(name, uid);
		claim(name, uid);
		contentTypes.set(uid, name);
	}
	return { contentTypes, components };
}

interface Usage {
	media: boolean;
	user: boolean;
	blocks: boolean;
}

const TO_ONE_RELATIONS = new Set(["oneToOne", "manyToOne", "morphToOne", "morphOne"]);

function relationTarget(attribute: RawAttribute, names: Names, usage: Usage): { tsType: string; doc: string } {
	const relation = attribute.relation ?? "";
	const target = attribute.target ?? "";
	const toOne = TO_ONE_RELATIONS.has(relation);
	if (target === USER_UID) usage.user = true;
	else if (target === MEDIA_UID) usage.media = true;
	const base = target === "" ? null : target === USER_UID ? "StrapiUser" : target === MEDIA_UID ? "StrapiMedia" : (names.contentTypes.get(target) ?? null);
	if (base === null) {
		const doc = target === "" ? `relation ${relation} (not generated)` : `relation ${relation} → ${target} (not generated)`;
		return { tsType: "unknown", doc };
	}
	return { tsType: toOne ? `${base} | null` : `${base}[]`, doc: `relation ${relation} → ${target}` };
}

function fieldType(attribute: RawAttribute, names: Names, usage: Usage): { tsType: string; doc?: string } {
	const type = attribute.type;
	if (STRING_TYPES.has(type)) return { tsType: "string", doc: type };
	if (NUMBER_TYPES.has(type)) return { tsType: "number", doc: type };
	if (type === "biginteger") return { tsType: "string", doc: "biginteger (serialized as string)" };
	if (type === "boolean") return { tsType: "boolean", doc: "boolean" };
	if (type === "json") return { tsType: "unknown", doc: "json" };
	if (type === "blocks") {
		usage.blocks = true;
		return { tsType: "StrapiBlock[]", doc: "blocks" };
	}
	if (type === "enumeration") {
		const values = attribute.enum ?? [];
		if (values.length === 0) return { tsType: "string", doc: "enumeration (no values)" };
		return { tsType: values.map((v) => JSON.stringify(v)).join(" | "), doc: "enumeration" };
	}
	if (type === "media") {
		usage.media = true;
		return { tsType: attribute.multiple ? "StrapiMedia[]" : "StrapiMedia | null", doc: attribute.multiple ? "media (multiple)" : "media" };
	}
	if (type === "relation") return relationTarget(attribute, names, usage);
	if (type === "component") {
		const uid = attribute.component ?? "";
		const name = names.components.get(uid);
		if (name === undefined) return { tsType: "unknown", doc: `component ${uid} (not generated)` };
		return { tsType: attribute.repeatable ? `${name}[]` : `${name} | null`, doc: `component ${uid}${attribute.repeatable ? " (repeatable)" : ""}` };
	}
	if (type === "dynamiczone") {
		const members: string[] = [];
		const missing: string[] = [];
		for (const uid of attribute.components ?? []) {
			const name = names.components.get(uid);
			if (name === undefined) missing.push(uid);
			else members.push(`(${name} & { __component: ${JSON.stringify(uid)} })`);
		}
		const doc = `dynamiczone${missing.length > 0 ? ` (not generated: ${missing.join(", ")})` : ""}`;
		if (members.length === 0) return { tsType: "unknown[]", doc };
		return { tsType: `Array<${members.join(" | ")}>`, doc };
	}
	return { tsType: "unknown", doc: `unsupported attribute type ${type}` };
}

function fields(attributes: Record<string, RawAttribute>, names: Names, usage: Usage): Field[] {
	const out: Field[] = [];
	for (const [name, attribute] of Object.entries(attributes)) {
		if (attribute.private === true) continue;
		const { tsType, doc } = fieldType(attribute, names, usage);
		const populatable = POPULATED_TYPES.has(attribute.type);
		const optional = attribute.required !== true || populatable;
		out.push({ name, tsType, optional, populatable, ...(doc !== undefined && { doc }) });
	}
	return out;
}

const byName = (a: { name: string }, b: { name: string }): number => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
const byKey = (a: { key: string }, b: { key: string }): number => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);

const RESERVED_DOCUMENT_FIELDS = new Set(["id", "documentId", "createdAt", "updatedAt", "publishedAt"]);

function assertNoReservedContentTypeFields(typeFields: Field[], uid: string, localized: boolean): void {
	for (const f of typeFields) {
		if (RESERVED_DOCUMENT_FIELDS.has(f.name) || (localized && f.name === "locale")) {
			throw new Error(`Attribute "${f.name}" on ${uid} collides with a StrapiDocument field; rename it in Strapi`);
		}
	}
}

function assertNoReservedComponentFields(typeFields: Field[], uid: string): void {
	for (const f of typeFields) {
		if (f.name === "id") {
			throw new Error(`Attribute "${f.name}" on ${uid} collides with the generated "id" field; rename it in Strapi`);
		}
	}
}

export function normalize(set: SchemaSet, options: NormalizeOptions): Model {
	const names = assignNames(set, options);
	const usage: Usage = { media: false, user: false, blocks: false };

	const components: TypeDecl[] = [];
	for (const [uid, entry] of set.components) {
		const componentFields = fields(entry.schema.attributes, names, usage);
		assertNoReservedComponentFields(componentFields, uid);
		components.push({
			name: mustGet(names.components, uid),
			kind: "component",
			uid,
			localized: false,
			fields: componentFields,
			doc: `Component ${uid} (${entry.schema.info.displayName})`,
		});
	}

	const contentTypes: TypeDecl[] = [];
	const collections: Model["collections"] = [];
	const singles: Model["singles"] = [];
	for (const [uid, entry] of set.contentTypes) {
		const name = names.contentTypes.get(uid);
		if (name === undefined) continue;
		const single = entry.schema.kind === "singleType";
		const localized = isLocalized(entry.schema);
		const contentTypeFields = fields(entry.schema.attributes, names, usage);
		assertNoReservedContentTypeFields(contentTypeFields, uid, localized);
		contentTypes.push({
			name,
			kind: single ? "single" : "collection",
			uid,
			localized,
			fields: contentTypeFields,
			doc: `${single ? "Single type" : "Collection type"} ${uid} (${entry.schema.info.displayName})`,
		});
		if (single) singles.push({ key: entry.schema.info.singularName, typeName: name });
		else collections.push({ key: entry.schema.info.pluralName, typeName: name });
	}

	return {
		types: [...components.sort(byName), ...contentTypes.sort(byName)],
		collections: collections.sort(byKey),
		singles: singles.sort(byKey),
		usesMedia: usage.media,
		usesUser: usage.user,
		usesBlocks: usage.blocks,
	};
}
