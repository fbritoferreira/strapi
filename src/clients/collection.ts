import { fail, ok, type Result } from "../errors";
import { fetchAll } from "../fetch-all";
import type { HttpClient } from "../http";
import { buildQuery } from "../query";
import type {
	CreatePayload,
	FetchInit,
	QueryParams,
	StrapiFilters,
	StrapiMeta,
	StrapiResponse,
	StrapiSingleResponse,
	UpdatePayload,
} from "../types";

/** Shared state a {@link Strapi} instance passes to each sub-client. */
export interface ClientContext {
	/** Shared HTTP layer. */
	http: HttpClient;
	/** Locale omitted from query strings. */
	defaultLocale: string;
	/** Max parallel page requests when fetching with `all: true`. */
	concurrency: number;
}

/** Options common to read methods. */
interface ReadOptions<T> {
	/** Query parameters (filters, populate, sort, pagination, status…). */
	params?: QueryParams<T>;
	/** Locale override for this call. */
	locale?: string;
	/** Extra `fetch` options merged into the request. */
	init?: FetchInit;
}

const NOT_FOUND = { status: 404, name: "NotFoundError", message: "Not Found" } as const;

/**
 * CRUD client for one collection type at `/api/<uid>`. Every method returns a
 * {@link Result} tuple; nothing throws for HTTP or network errors.
 */
export class CollectionClient<T extends object> {
	protected readonly http: HttpClient;
	protected readonly defaultLocale: string;
	protected readonly concurrency: number;
	/** Plural API id, e.g. `articles`. */
	readonly uid: string;

	/** Usually obtained via {@link Strapi.collection} rather than constructed directly. */
	constructor(context: ClientContext, uid: string) {
		this.http = context.http;
		this.defaultLocale = context.defaultLocale;
		this.concurrency = context.concurrency;
		this.uid = uid;
	}

	/** Serialises `params` (and `locale`) into a query string, or `""` when empty. */
	protected query(params: QueryParams<T> | undefined, locale: string | undefined): string {
		return buildQuery(params, { defaultLocale: this.defaultLocale, ...(locale !== undefined && { locale }) });
	}

	/**
	 * `GET /api/<uid>`. Lists documents.
	 *
	 * With `all: true`, follows pagination and fetches every page (up to
	 * `concurrency` in parallel), returning the concatenated data.
	 */
	async findMany(options: ReadOptions<T> & { all?: boolean } = {}): Promise<Result<T[]>> {
		const { params, locale, all = false, init } = options;
		if (all) {
			return fetchAll<T>({
				http: this.http,
				path: this.uid,
				defaultLocale: this.defaultLocale,
				concurrency: this.concurrency,
				...(params && { params }),
				...(locale !== undefined && { locale }),
				...(init && { init }),
			});
		}
		const [err, body] = await this.http.request<StrapiResponse<T>>(`${this.uid}${this.query(params, locale)}`, {
			...init,
			method: "GET",
		});
		if (err) return fail(err);
		return ok(body?.data ?? [], toMeta(body));
	}

	/** `GET /api/<uid>/<documentId>`. Fails with `NotFoundError` when the document is missing. */
	async find(options: ReadOptions<T> & { documentId: string }): Promise<Result<T>> {
		const { documentId, params, locale, init } = options;
		const [err, body] = await this.http.request<StrapiSingleResponse<T>>(
			`${this.uid}/${encodeURIComponent(documentId)}${this.query(params, locale)}`,
			{ ...init, method: "GET" }
		);
		if (err) return fail(err);
		if (!body?.data) return fail(NOT_FOUND);
		return ok(body.data, toMeta(body));
	}

	/** First document matching `params`, or `null`. Forces a page size of 1. */
	async findFirst(options: ReadOptions<T> = {}): Promise<Result<T | null>> {
		const { params, locale, init } = options;
		const pagination = params?.pagination;
		const isOffsetShaped = pagination?.start !== undefined || pagination?.limit !== undefined;
		const [err, data, meta] = await this.findMany({
			params: {
				...params,
				pagination: isOffsetShaped ? { ...pagination, limit: 1 } : { ...pagination, pageSize: 1 },
			},
			...(locale !== undefined && { locale }),
			...(init && { init }),
		});
		if (err) return fail(err);
		return ok(data[0] ?? null, meta);
	}

	/** Total number of documents matching `params`, read from `meta.pagination.total`. */
	async count(options: ReadOptions<T> = {}): Promise<Result<number>> {
		const { params, locale, init } = options;
		const [err, data, meta] = await this.findMany({
			params: { ...params, pagination: { pageSize: 1 } },
			...(locale !== undefined && { locale }),
			...(init && { init }),
		});
		if (err) return fail(err);
		return ok(meta?.pagination?.total ?? data.length, meta);
	}

	/**
	 * `POST /api/<uid>`. Creates a document.
	 *
	 * For a non-default `locale`, Strapi requires the localization to be added
	 * to an existing default-locale document. This method looks that document up
	 * via `filters` (creating it when nothing matches) and then `PUT`s the
	 * localized payload against its `documentId`.
	 */
	async create(options: {
		payload: CreatePayload<T>;
		params?: Omit<QueryParams<T>, "filters">;
		locale?: string;
		filters?: StrapiFilters<T>;
		init?: FetchInit;
	}): Promise<Result<T>> {
		const { payload, params, filters, init } = options;
		const locale = options.locale ?? this.defaultLocale;

		if (locale === this.defaultLocale) {
			return this.post(`${this.uid}${this.query(params, undefined)}`, payload, init);
		}

		// Non-default locale: find or create the default-locale document, then add the localization.
		// The base-document lookup uses only `filters` (plus a forced pageSize of 1), never the
		// caller's `params` — sort/pagination/status shape the response shape, not which document
		// is the localization base. With no `filters` there is nothing to match on, so the lookup
		// is skipped entirely and a fresh default-locale document is created instead.
		let documentId: string | undefined;
		if (filters) {
			const searchQuery = this.query({ filters, pagination: { pageSize: 1 } }, this.defaultLocale);
			const [searchErr, found] = await this.http.request<StrapiResponse<T>>(`${this.uid}${searchQuery}`, {
				...init,
				method: "GET",
			});
			if (searchErr) return fail(searchErr);

			const firstFound = found?.data?.[0];
			documentId = firstFound ? documentIdOf(firstFound) : undefined;
		}

		if (!documentId) {
			const basePayload = { ...payload, data: { ...payload.data, locale: this.defaultLocale } };
			const [createErr, created] = await this.post(`${this.uid}${this.query(params, undefined)}`, basePayload, init);
			if (createErr) return fail(createErr);
			documentId = documentIdOf(created);
			if (!documentId) return fail({ message: "Strapi API error: created document has no documentId", name: "HTTPError" });
		}

		return this.update({ documentId, payload, ...(params && { params }), locale, ...(init && { init }) });
	}

	/** `PUT /api/<uid>/<documentId>`. Updates (or adds a localization to) a document. */
	async update(options: {
		documentId: string;
		payload: UpdatePayload<T>;
		params?: QueryParams<T>;
		locale?: string;
		init?: FetchInit;
	}): Promise<Result<T>> {
		const { documentId, payload, params, locale, init } = options;
		const [err, body] = await this.http.request<StrapiSingleResponse<T>>(
			`${this.uid}/${encodeURIComponent(documentId)}${this.query(params, locale)}`,
			{ ...init, method: "PUT", body: JSON.stringify(payload) }
		);
		if (err) return fail(err);
		if (!body?.data) return fail(NOT_FOUND);
		return ok(body.data, toMeta(body));
	}

	/** `DELETE /api/<uid>/<documentId>`. With `locale`, deletes only that localization. */
	async delete(options: { documentId: string; locale?: string; init?: FetchInit }): Promise<Result<null>> {
		const { documentId, locale, init } = options;
		const [err] = await this.http.request<unknown>(
			`${this.uid}/${encodeURIComponent(documentId)}${this.query(undefined, locale)}`,
			{ ...init, method: "DELETE" }
		);
		if (err) return fail(err);
		return ok(null);
	}

	/** Updates the first document matching `filters`, or creates one when none matches. */
	async upsert(options: {
		payload: CreatePayload<T>;
		filters?: StrapiFilters<T>;
		params?: Omit<QueryParams<T>, "filters">;
		locale?: string;
		init?: FetchInit;
	}): Promise<Result<T>> {
		const { payload, filters, params, locale, init } = options;
		const [searchErr, existing] = await this.findFirst({
			params: { ...params, ...(filters && { filters }) },
			...(locale !== undefined && { locale }),
			...(init && { init }),
		});
		if (searchErr) return fail(searchErr);

		const documentId = existing ? documentIdOf(existing) : undefined;
		if (documentId) {
			return this.update({ documentId, payload, ...(params && { params }), ...(locale !== undefined && { locale }), ...(init && { init }) });
		}
		return this.create({ payload, ...(params && { params }), ...(filters && { filters }), ...(locale !== undefined && { locale }), ...(init && { init }) });
	}

	/** `POST` helper that unwraps `data` and maps an empty body to `NotFoundError`. */
	protected async post<R extends object = T>(path: string, payload: CreatePayload<T> | { data: unknown }, init?: FetchInit): Promise<Result<R>> {
		const [err, body] = await this.http.request<StrapiSingleResponse<R>>(path, {
			...init,
			method: "POST",
			body: JSON.stringify(payload),
		});
		if (err) return fail(err);
		if (!body?.data) return fail(NOT_FOUND);
		return ok(body.data, toMeta(body));
	}
}

function toMeta(body: { meta?: StrapiResponse<unknown>["meta"] } | null | undefined): StrapiMeta {
	if (!body || body.meta === undefined) return null;
	return body.meta;
}

/** Narrows a Strapi document's `documentId` without casting the whole object. */
function documentIdOf(doc: object): string | undefined {
	return "documentId" in doc && typeof doc.documentId === "string" ? doc.documentId : undefined;
}
