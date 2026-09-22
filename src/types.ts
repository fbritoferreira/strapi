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

/** Fields Strapi returns whatever `fields` asks for: the selection is `[id, documentId, ...fields]`. */
type SystemKey = "id" | "documentId";

/** First segment of a dotted populate path: `"author.avatar"` populates `author`. */
type Head<S> = S extends `${infer H}.${string}` ? H : S;

/** The document without its populatable fields or the marker: what a plain read returns. */
type ScalarPart<T> = Omit<T, PopulatableKey<T> | PopulatableMarker>;

/** The document restricted to a literal `fields` list, plus the keys Strapi always returns. */
type PickFields<T, F> = F extends readonly (infer K)[]
	? Pick<T, Extract<K | SystemKey, keyof T>>
	: ScalarPart<T>;

/** Keys a literal `populate` value asks for. */
type PopulatedKeys<T, P> = P extends "*"
	? PopulatableKey<T> & keyof T
	: P extends readonly (infer K)[]
		? Extract<Head<K>, keyof T>
		: P extends string
			? Extract<Head<P>, keyof T>
			: P extends object
				? Extract<keyof P, keyof T>
				: never;

/** True when a param is present but not a literal, so nothing can be narrowed from it. */
type Loose<P> =
	| ("fields" extends keyof P ? (undefined extends P["fields"] ? true : false) : false)
	| ("populate" extends keyof P ? (undefined extends P["populate"] ? true : false) : false);

/**
 * The document as one read with params `P` actually returns it.
 *
 * With a literal `fields`, only those attributes come back, plus `id` and
 * `documentId`, which Strapi always selects. Populatable fields appear only
 * when `populate` asks for them, and are no longer optional when it does.
 *
 * Narrowing needs two things: a type carrying the generator's `__populatable`
 * marker, and params literal enough to read — pass them inline. Anything else
 * (a hand-written type, params held in a variable) yields `T` unchanged.
 */
export type SelectedDoc<T, P> = PopulatableMarker extends keyof T
	? true extends Loose<P>
		? T
		: ("fields" extends keyof P ? PickFields<T, P["fields"]> : ScalarPart<T>) &
				("populate" extends keyof P ? Required<Pick<T, PopulatedKeys<T, P["populate"]>>> : unknown)
	: T;

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

/**
 * Property the generator adds listing the fields Strapi writes by reference —
 * relations and media. A subset of {@link PopulatableMarker}: components and
 * dynamic zones are embedded, so they are written inline.
 */
export type RelationMarker = "__relations";

/** Fields written by reference, when the generator marked them. */
export type RelationKey<T> = RelationMarker extends keyof T
	? Extract<T[RelationMarker & keyof T], string>
	: never;

/** Where a connected relation goes in an ordered to-many field. */
export interface RelationPosition {
	before?: string | number;
	after?: string | number;
	start?: true;
	end?: true;
}

/** A related document addressed by its `documentId`, optionally per locale or status. */
export interface RelationDocumentRef {
	documentId: string | number;
	locale?: string;
	status?: "draft" | "published";
	position?: RelationPosition;
}

/** A related row addressed by its numeric `id`. */
export interface RelationEntityRef {
	id: string | number;
	position?: RelationPosition;
}

/** One relation reference: a `documentId` shorthand, or either longhand form. */
export type RelationRef = string | number | RelationDocumentRef | RelationEntityRef;

/** `connect`, `disconnect` and `set`, the longhand for changing a relation. */
export interface RelationCommands<V> {
	connect?: V;
	disconnect?: V;
	set?: V;
}

/**
 * Value a relation field accepts on write. To-many fields take a list, to-one
 * fields take a single reference or `null`; both take the command object.
 */
export type RelationInput<V> = NonNullable<V> extends readonly unknown[]
	? readonly RelationRef[] | RelationCommands<readonly RelationRef[] | RelationRef>
	: RelationRef | null | RelationCommands<readonly RelationRef[] | RelationRef>;

/**
 * Value a non-relation field accepts on write: components and dynamic zones
 * inline and recursively optional, arrays element-wise, scalars as they are.
 */
type WriteValue<V> = NonNullable<V> extends readonly (infer E)[]
	? readonly DeepPartial<E>[] | Extract<V, null>
	: NonNullable<V> extends object
		? DeepPartial<NonNullable<V>> | Extract<V, null>
		: V;

/**
 * Body of a create or update, typed the way Strapi accepts it: relations and
 * media by reference, components and dynamic zones inline, and the markers
 * themselves left out.
 *
 * Without the generator's `__relations` marker this is {@link DeepPartial},
 * the previous behaviour.
 */
export type WriteData<T> = RelationMarker extends keyof T
	? {
			[K in Exclude<keyof T, PopulatableMarker | RelationMarker>]?: K extends RelationKey<T>
				? RelationInput<T[K]>
				: WriteValue<T[K]>;
		}
	: DeepPartial<T>;

/** Recursively optional version of `T`. Used for create and update payloads. */
export type DeepPartial<T> = {
	[P in Exclude<keyof T, PopulatableMarker>]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Publication cohort a read is restricted to. Strapi validates this value and
 * answers a 400 for anything outside this union.
 */
export type PublicationFilter =
	| "never-published"
	| "has-published-version"
	| "modified"
	| "unmodified"
	| "never-published-document"
	| "has-published-version-document"
	| "published-without-draft"
	| "published-with-draft";

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
	/** Full-text search across the content type's searchable fields. */
	_q?: string;
	/** i18n locale. Omitted from the query string when it equals the configured `defaultLocale`. */
	locale?: string;
	/** Strapi 5 Draft & Publish status. Defaults to `published` server-side. */
	status?: "draft" | "published";
	/**
	 * Strapi 5 filter on how the draft and published versions of a document
	 * relate to each other. See {@link PublicationFilter}.
	 */
	publicationFilter?: PublicationFilter;
	/** @deprecated Superseded by `publicationFilter`; Strapi keeps it for older clients. */
	hasPublishedVersion?: boolean | "true" | "false";
	/** @deprecated Strapi 4 only. Use `status` on Strapi 5. */
	publicationState?: "live" | "preview" | "draft";
}

/** Params every content-API route carries when the content type enables i18n or Draft & Publish. */
type ConditionalParam = "locale" | "status" | "publicationFilter" | "hasPublishedVersion" | "publicationState";

/**
 * Params a list route accepts (`GET /api/<uid>`): the full read surface.
 *
 * The per-route sets below mirror the zod contracts Strapi declares for its
 * core routes, so a param the endpoint ignores — or rejects outright under
 * `api.rest.strictParams` — cannot be passed in the first place.
 */
export type ListQueryParams<T> = Pick<
	QueryParams<T>,
	"fields" | "filters" | "sort" | "populate" | "pagination" | "_q" | ConditionalParam
>;

/** Params a single-document read accepts (`GET /api/<uid>/<documentId>`): no pagination, no `_q`. */
export type FindQueryParams<T> = Pick<QueryParams<T>, "fields" | "filters" | "sort" | "populate" | ConditionalParam>;

/** Params a write accepts (`POST`/`PUT`): they shape the returned document, not which documents are touched. */
export type WriteQueryParams<T> = Pick<QueryParams<T>, "fields" | "populate" | ConditionalParam>;

/**
 * Params the users-permissions and upload list routes accept. They are not
 * content-API routes, so they carry no `status`, `locale` or `_q`.
 */
export type PluginListQueryParams<T> = Pick<QueryParams<T>, "fields" | "filters" | "sort" | "populate" | "pagination">;

/** Params those plugins' single-document routes accept. */
export type PluginFindQueryParams<T> = Pick<QueryParams<T>, "fields" | "populate">;

/** Params a delete accepts (`DELETE /api/<uid>/<documentId>`). */
export type DeleteQueryParams<T> = Pick<QueryParams<T>, "fields" | "filters" | "populate" | ConditionalParam>;

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
	data: WriteData<T>;
}

/** Request body for updating a document. Strapi expects attributes wrapped in `data`. */
export interface UpdatePayload<T> {
	data: WriteData<T>;
}

/** Pagination block Strapi returns in `meta`, page-based or offset-based depending on the request. */
export type StrapiPagination =
	| { page: number; pageSize: number; pageCount: number; total: number }
	| { start: number; limit: number; total: number };

/** Third element of a {@link Result} tuple: Strapi's `meta` object, or `null` when the endpoint returns none. */
export type StrapiMeta = { pagination?: StrapiPagination } | null;

/** One entry of a GraphQL response's `errors` array. */
export interface GraphqlError {
	message: string;
	path?: (string | number)[];
	extensions?: { code?: string; [key: string]: unknown };
}

/**
 * A GraphQL document carrying its result and variable types, as
 * `TypedDocumentNode` and graphql-codegen's `TypedDocumentString` do. The
 * marker exists only in the type system, so this matches either without
 * depending on `graphql` or `@graphql-typed-document-node/core`.
 */
export interface TypedDocument<TData = unknown, TVariables = Record<string, unknown>> {
	readonly __apiType?: (variables: TVariables) => TData;
}

/** Options every GraphQL call takes, with `variables` typed by the document. */
export interface GraphqlOptions<TVariables> {
	variables?: TVariables;
	/** Operation to run when the document declares more than one. */
	operationName?: string;
	init?: FetchInit;
}

/** Same, for a document whose variables are not all optional. */
export interface RequiredGraphqlOptions<TVariables> extends GraphqlOptions<TVariables> {
	variables: TVariables;
}

/**
 * Argument list of {@link Strapi.graphql} for a typed document: `variables` is
 * required exactly when the document declares a variable that is.
 */
export type GraphqlArgs<TVariables> = Record<string, never> extends TVariables
	? [options?: GraphqlOptions<TVariables>]
	: [options: RequiredGraphqlOptions<TVariables>];

/** Body a GraphQL endpoint returns: data, errors, or both. */
export interface GraphqlResponse<T> {
	data?: T | null;
	errors?: GraphqlError[];
}

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
	/** `focalPoint` JSON field, when the instance sets one. */
	focalPoint?: unknown;
	/** The entry this file is attached to; shape depends on the content type. */
	related?: unknown;
}

/** `plugin::users-permissions.role`, as returned when a user's role is populated. */
export interface StrapiRole {
	id: number;
	name: string;
	description: string | null;
	type: string;
	createdAt: string;
	updatedAt: string;
}

/** Body the auth routes answer with once a session exists. */
export interface AuthSession<T = StrapiUser> {
	jwt: string;
	/** Only in the `"refresh"` JWT mode, and omitted when it travels in an httpOnly cookie. */
	refreshToken?: string;
	user: T;
}

/**
 * Body `POST /api/auth/local/register` answers with. `jwt` is absent when email
 * confirmation is enabled: the account exists but cannot sign in yet.
 */
export interface RegisterResult<T = StrapiUser> {
	jwt?: string;
	refreshToken?: string;
	user: T;
}

/** Body `POST /api/auth/refresh` answers with. */
export interface RefreshedSession {
	jwt: string;
	/** Omitted when the rotated token is set as an httpOnly cookie instead. */
	refreshToken?: string;
}

/** Body `POST /api/auth/send-email-confirmation` answers with. */
export interface SentEmailConfirmation {
	email: string;
	sent: boolean;
}

/** Body `POST /api/auth/logout` answers with. */
export interface LogoutResult {
	ok: boolean;
}

/** `plugin::users-permissions.user` as returned by `/api/users`. */
export interface StrapiUser extends StrapiDocument {
	username: string;
	email: string;
	provider: string;
	confirmed: boolean;
	blocked: boolean;
	/** The role id, or the role itself when populated. */
	role?: number | StrapiRole;
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

/**
 * Contract of one route: what it takes and what it answers. Generated from an
 * OpenAPI document; `params` and `body` are required when the route declares
 * them, `query` is always optional.
 */
export interface RouteContract {
	params?: Record<string, string | number>;
	query?: unknown;
	body?: unknown;
	response: unknown;
}

/**
 * Augment this from generated code to call routes by name with
 * {@link Strapi.route}. Keys are `"<METHOD> <path>"`, e.g. `"GET /upload/files"`.
 */
export interface StrapiRoutes {
	/** Marker so the interface is not empty; never set. */
	readonly __brand?: never;
}

/** Options {@link Strapi.route} takes for the route `C`: its own contract, minus the response. */
export type RouteOptions<C> = Omit<C, "response"> & { init?: FetchInit };

/**
 * Argument list of {@link Strapi.route}. Options are required for a route that
 * declares path params or a body, and optional for one that declares neither.
 */
export type RouteArgs<C> = C extends { params: unknown }
	? [options: RouteOptions<C>]
	: C extends { body: unknown }
		? [options: RouteOptions<C>]
		: [options?: RouteOptions<C>];

/** Same as {@link StrapiContentTypes} for single types. */
export interface StrapiSingleTypes {
	/** Marker so the interface is not empty; never set. */
	readonly __brand?: never;
}
