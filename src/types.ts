/** Filter operators accepted by the Strapi REST API `filters` query parameter. */
export type StrapiOperator =
	| "$eq"
	| "$eqi"
	| "$ne"
	| "$nei"
	| "$lt"
	| "$lte"
	| "$gt"
	| "$gte"
	| "$in"
	| "$notIn"
	| "$contains"
	| "$notContains"
	| "$containsi"
	| "$notContainsi"
	| "$null"
	| "$notNull"
	| "$between"
	| "$startsWith"
	| "$startsWithi"
	| "$endsWith"
	| "$endsWithi"
	| "$or"
	| "$and"
	| "$not";

/** A filter on one field: either a literal value (`$eq`) or a map of operators to values. */
export type FieldFilterValue<V> = V | Partial<Record<StrapiOperator, V | V[]>>;

/**
 * Property the generator adds to a document type, listing the fields Strapi can
 * populate. It is a type-level marker: Strapi never returns it.
 */
export type PopulatableMarker = "__populatable";

/**
 * Fields `populate` accepts — relations, components, media and dynamic zones.
 * Falls back to every key for a hand-written type with no marker.
 */
export type PopulatableKey<T> = PopulatableMarker extends keyof T
	? Extract<T[PopulatableMarker & keyof T], string>
	: keyof T & string;

/**
 * Fields `fields` and `sort` accept — everything the generator did not mark as
 * populatable. Falls back to every key for a hand-written type with no marker.
 */
export type ScalarKey<T> = PopulatableMarker extends keyof T
	? Exclude<keyof T & string, Extract<T[PopulatableMarker & keyof T], string> | PopulatableMarker>
	: keyof T & string;

/** Document behind a populatable field, with arrays and `| null` unwrapped. */
type Related<V> = NonNullable<V> extends readonly (infer E)[] ? E : NonNullable<V>;

/** Typed `filters` object for a document of shape `T`. Nested objects filter on relations and components. */
export type StrapiFilters<T> = {
	[K in Exclude<keyof T, PopulatableMarker>]?: T[K] extends object
		? StrapiFilters<T[K]> | FieldFilterValue<T[K]>
		: FieldFilterValue<T[K]>;
} & {
	$and?: StrapiFilters<T>[];
	$or?: StrapiFilters<T>[];
	$not?: StrapiFilters<T>;
};

/** Value for one key of a {@link Populate} map: `true`, `"*"`, or a nested populate. */
export type PopulateValue<T> = true | "*" | { populate: Populate<T> };

/** One entry of a `populate` list: a populatable field, or a dotted path starting at one. */
export type PopulatePath<T> = PopulatableKey<T> | `${PopulatableKey<T> & string}.${string}`;

/** Typed `populate` query parameter: `"*"`, a field, a list of fields, or a per-field map. */
export type Populate<T> =
	| "*"
	| PopulatePath<T>
	| PopulatePath<T>[]
	| { [K in PopulatableKey<T> & keyof T]?: PopulateValue<Related<T[K]>> };

/** Sort direction suffix, as in `title:asc`. */
export type SortDirection = "asc" | "desc";

/**
 * One entry of the `sort` query parameter: a field name, optionally suffixed
 * with `:asc` or `:desc`. Relation paths (`author.name:asc`) are anchored to a
 * field of `T`, so a typo in the first segment is a compile error.
 */
export type SortField<T> =
	| ScalarKey<T>
	| `${ScalarKey<T>}:${SortDirection}`
	| `${PopulatableKey<T> & string}.${string}`;

/** Recursively optional version of `T`. Used for create and update payloads. */
export type DeepPartial<T> = {
	[P in Exclude<keyof T, PopulatableMarker>]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/** Query parameters accepted by Strapi REST read endpoints, typed against the document shape `T`. */
export interface QueryParams<T = unknown> {
	/** Filter documents. See {@link StrapiFilters}. */
	filters?: StrapiFilters<T>;
	/** Populate relations, components and media. See {@link Populate}. */
	populate?: Populate<T>;
	/** Restrict the returned attributes to these fields. Populatable fields belong in `populate`. */
	fields?: ScalarKey<T>[];
	/** Sort order, e.g. `["publishedAt:desc"]`. */
	sort?: SortField<T>[];
	/**
	 * Page-based (`page` + `pageSize`) or offset-based (`start` + `limit`)
	 * pagination. Strapi ignores `pageCount` on requests; it is kept for
	 * backwards compatibility only.
	 */
	pagination?: {
		page?: number;
		pageSize?: number;
		/** @deprecated Not a request parameter in Strapi; has no effect. */
		pageCount?: number;
		withCount?: boolean;
		start?: number;
		limit?: number;
	};
	/** i18n locale. Omitted from the query string when it equals the configured `defaultLocale`. */
	locale?: string;
	/** Strapi 5 Draft & Publish status. Defaults to `published` server-side. */
	status?: "draft" | "published";
	/**
	 * Strapi 5 filter on how the draft and published versions of a document
	 * relate to each other.
	 */
	publicationFilter?: "all" | "modified" | "published" | "unpublished";
	/** @deprecated Strapi 4 only. Use `status` on Strapi 5. */
	publicationState?: "live" | "preview" | "draft";
}

/** Response body of a collection-type list endpoint. */
export interface StrapiResponse<T> {
	data: T[];
	meta?: { pagination?: StrapiPagination };
}

/** Response body of a single-document endpoint (find one, create, update, single types). */
export interface StrapiSingleResponse<T> {
	data: T;
	meta?: { pagination?: StrapiPagination };
}

/** Request body for creating a document. Strapi expects attributes wrapped in `data`. */
export interface CreatePayload<T> {
	data: DeepPartial<T>;
}

/** Request body for updating a document. Strapi expects attributes wrapped in `data`. */
export interface UpdatePayload<T> {
	data: DeepPartial<T>;
}

/** Pagination block Strapi returns in `meta`, page-based or offset-based depending on the request. */
export type StrapiPagination =
	| { page: number; pageSize: number; pageCount: number; total: number }
	| { start: number; limit: number; total: number };

/** Third element of a {@link Result} tuple: Strapi's `meta` object, or `null` when the endpoint returns none. */
export type StrapiMeta = { pagination?: StrapiPagination } | null;

/** Shape Strapi 5 returns for any non-2xx response. */
export interface StrapiErrorBody {
	data: null;
	error: {
		status: number;
		name: string;
		message: string;
		details?: unknown;
	};
}

/** Fields Strapi 5 adds to every document. `locale` only when i18n is enabled. */
export interface StrapiDocument {
	id: number;
	documentId: string;
	createdAt: string;
	updatedAt: string;
	publishedAt: string | null;
	locale?: string;
}

/** One generated size of an uploaded image (`thumbnail`, `small`, `medium`, `large`). */
export interface StrapiMediaFormat {
	name: string;
	hash: string;
	ext: string;
	mime: string;
	width: number;
	height: number;
	size: number;
	url: string;
}

/** `plugin::upload.file` as returned by the REST API. */
export interface StrapiMedia extends StrapiDocument {
	name: string;
	alternativeText: string | null;
	caption: string | null;
	width: number | null;
	height: number | null;
	formats: Record<string, StrapiMediaFormat> | null;
	hash: string;
	ext: string;
	mime: string;
	size: number;
	url: string;
	previewUrl: string | null;
	provider: string;
	provider_metadata: unknown;
}

/** `plugin::users-permissions.user` as returned by `/api/users`. */
export interface StrapiUser extends StrapiDocument {
	username: string;
	email: string;
	provider: string;
	confirmed: boolean;
	blocked: boolean;
}

/** Minimal node of a Strapi `blocks` (rich text) field. */
export interface StrapiBlock {
	type: string;
	children?: StrapiBlock[];
	text?: string;
	[key: string]: unknown;
}

/** `RequestInit` plus the Next.js `fetch` extension. Merged last into every request. */
export type FetchInit = RequestInit & {
	next?: { revalidate?: number | false; tags?: string[] };
};

/**
 * Augment these from generated code to get `strapi.collection("articles")`
 * typed without a type argument. Keys are REST path segments.
 */
export interface StrapiContentTypes {
	/** Marker so the interface is not empty; never set. */
	readonly __brand?: never;
}

/** Same as {@link StrapiContentTypes} for single types. */
export interface StrapiSingleTypes {
	/** Marker so the interface is not empty; never set. */
	readonly __brand?: never;
}
