export type AttributeType =
	| "string" | "text" | "richtext" | "blocks" | "email" | "password" | "uid"
	| "date" | "time" | "datetime" | "timestamp"
	| "integer" | "biginteger" | "float" | "decimal" | "boolean" | "json"
	| "enumeration" | "media" | "relation" | "component" | "dynamiczone"
	| (string & {});

export interface RawAttribute {
	type: AttributeType;
	required?: boolean;
	private?: boolean;
	multiple?: boolean;
	allowedTypes?: string[];
	enum?: string[];
	relation?: string;
	target?: string;
	targetAttribute?: string | null;
	component?: string;
	repeatable?: boolean;
	components?: string[];
	customField?: string;
	pluginOptions?: Record<string, unknown>;
	[key: string]: unknown;
}

export interface RawContentTypeSchema {
	kind: "collectionType" | "singleType";
	collectionName?: string;
	info: { singularName: string; pluralName: string; displayName: string; description?: string };
	options?: Record<string, unknown>;
	pluginOptions?: { i18n?: { localized?: boolean }; [key: string]: unknown };
	attributes: Record<string, RawAttribute>;
}

export interface RawComponentSchema {
	collectionName?: string;
	info: { displayName: string; icon?: string; description?: string };
	options?: Record<string, unknown>;
	attributes: Record<string, RawAttribute>;
}

export interface ContentTypeEntry {
	uid: string;
	schema: RawContentTypeSchema;
}

export interface ComponentEntry {
	uid: string;
	category: string;
	schema: RawComponentSchema;
}

export interface SchemaSet {
	contentTypes: Map<string, ContentTypeEntry>;
	components: Map<string, ComponentEntry>;
}

export const MEDIA_UID = "plugin::upload.file";
export const USER_UID = "plugin::users-permissions.user";

export function isApiUid(uid: string): boolean {
	return uid.startsWith("api::");
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isLocalized(schema: RawContentTypeSchema): boolean {
	return schema.pluginOptions?.i18n?.localized === true;
}
