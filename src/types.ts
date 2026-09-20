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

export type FieldFilterValue<V> = V | Partial<Record<StrapiOperator, V | V[]>>;

export type StrapiFilters<T> = {
	[K in keyof T]?: T[K] extends object
		? StrapiFilters<T[K]> | FieldFilterValue<T[K]>
		: FieldFilterValue<T[K]>;
} & {
	$and?: StrapiFilters<T>[];
	$or?: StrapiFilters<T>[];
	$not?: StrapiFilters<T>;
};

export type PopulateValue<T> =
	| true
	| "*"
	| { populate: Populate<T> }
	| Partial<
			Record<
				keyof T,
				T[keyof T] extends object ? PopulateValue<T[keyof T]> : never
			>
	  >;

export type Populate<T> =
	| "*"
	| Partial<
			Record<
				keyof T,
				T[keyof T] extends object ? PopulateValue<T[keyof T]> : never
			>
	  >
	| string[];

export type SortDirection = "asc" | "desc";

export type SortField<T> =
	| (keyof T & string)
	| `${keyof T & string}:${SortDirection}`
	| `${string}:${SortDirection}`;

export type DeepPartial<T> = {
	[P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export interface QueryParams<T = unknown> {
	filters?: StrapiFilters<T>;
	populate?: Populate<T>;
	fields?: (keyof T)[];
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

export interface StrapiResponse<T> {
	data: T[];
	meta?: { pagination?: StrapiPagination };
}

export interface StrapiSingleResponse<T> {
	data: T;
	meta?: { pagination?: StrapiPagination };
}

export interface CreatePayload<T> {
	data: DeepPartial<T>;
}

export interface UpdatePayload<T> {
	data: DeepPartial<T>;
}

export type StrapiPagination =
	| { page: number; pageSize: number; pageCount: number; total: number }
	| { start: number; limit: number; total: number };

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
	readonly __brand?: never;
}
