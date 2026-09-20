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

export interface ClientContext {
	http: HttpClient;
	defaultLocale: string;
	concurrency: number;
}

interface ReadOptions<T> {
	params?: QueryParams<T>;
	locale?: string;
	init?: FetchInit;
}

const NOT_FOUND = { status: 404, name: "NotFoundError", message: "Not Found" } as const;

export class CollectionClient<T extends object> {
	protected readonly http: HttpClient;
	protected readonly defaultLocale: string;
	protected readonly concurrency: number;
	readonly uid: string;

	constructor(context: ClientContext, uid: string) {
		this.http = context.http;
		this.defaultLocale = context.defaultLocale;
		this.concurrency = context.concurrency;
		this.uid = uid;
	}

	protected query(params: QueryParams<T> | undefined, locale: string | undefined): string {
		return buildQuery(params, { defaultLocale: this.defaultLocale, ...(locale !== undefined && { locale }) });
	}

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

	async findFirst(options: ReadOptions<T> = {}): Promise<Result<T | null>> {
		const { params, locale, init } = options;
		const [err, data, meta] = await this.findMany({
			params: { ...params, pagination: { ...params?.pagination, pageSize: 1 } },
			...(locale !== undefined && { locale }),
			...(init && { init }),
		});
		if (err) return fail(err);
		return ok(data[0] ?? null, meta);
	}

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
		// is the localization base.
		const searchQuery = this.query({ ...(filters && { filters }), pagination: { pageSize: 1 } }, this.defaultLocale);
		const [searchErr, found] = await this.http.request<StrapiResponse<T>>(`${this.uid}${searchQuery}`, {
			...init,
			method: "GET",
		});
		if (searchErr) return fail(searchErr);

		const firstFound = found?.data?.[0];
		let documentId = firstFound ? documentIdOf(firstFound) : undefined;
		if (!documentId) {
			const basePayload = { ...payload, data: { ...payload.data, locale: this.defaultLocale } };
			const [createErr, created] = await this.post(`${this.uid}${this.query(params, undefined)}`, basePayload, init);
			if (createErr) return fail(createErr);
			documentId = documentIdOf(created);
			if (!documentId) return fail({ message: "Strapi API error: created document has no documentId", name: "HTTPError" });
		}

		return this.update({ documentId, payload, ...(params && { params }), locale, ...(init && { init }) });
	}

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

	async delete(options: { documentId: string; locale?: string; init?: FetchInit }): Promise<Result<null>> {
		const { documentId, locale, init } = options;
		const [err] = await this.http.request<unknown>(
			`${this.uid}/${encodeURIComponent(documentId)}${this.query(undefined, locale)}`,
			{ ...init, method: "DELETE" }
		);
		if (err) return fail(err);
		return ok(null);
	}

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
