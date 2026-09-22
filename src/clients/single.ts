import { fail, ok, type Result } from "../errors";
import type { HttpClient } from "../http";
import { buildQuery } from "../query";
import type {
	FetchInit,
	FindQueryParams,
	QueryParams,
	SelectedDoc,
	StrapiMeta,
	StrapiSingleResponse,
	UpdatePayload,
	WriteQueryParams,
} from "../types";
import type { ClientContext } from "./collection";

const NOT_FOUND = { status: 404, name: "NotFoundError", message: "Not Found" } as const;

/**
 * Client for one single type at `/api/<uid>`. Single types hold exactly one
 * document per locale, so there is no list or `documentId`.
 */
export class SingleTypeClient<T extends object> {
	private readonly http: HttpClient;
	private readonly defaultLocale: string;
	/** Singular API id, e.g. `homepage`. */
	readonly uid: string;

	/** Usually obtained via {@link Strapi.single} rather than constructed directly. */
	constructor(context: ClientContext, uid: string) {
		this.http = context.http;
		this.defaultLocale = context.defaultLocale;
		this.uid = uid;
	}

	private query(params: QueryParams<T> | undefined, locale: string | undefined): string {
		return buildQuery(params, { defaultLocale: this.defaultLocale, ...(locale !== undefined && { locale }) });
	}

	/**
	 * `GET /api/<uid>`. Fails with `NotFoundError` when the single type has no
	 * document yet. The result is narrowed by `params`, as on collections.
	 */
	async find<const P extends FindQueryParams<T> = object>(
		options: { params?: P; locale?: string; init?: FetchInit } = {}
	): Promise<Result<SelectedDoc<T, P>>> {
		const { params, locale, init } = options;
		return this.single<SelectedDoc<T, P>>(`${this.uid}${this.query(params, locale)}`, { ...init, method: "GET" });
	}

	/** `PUT /api/<uid>`. Creates the document on first call, updates it afterwards. */
	async update<const P extends WriteQueryParams<T> = object>(options: {
		payload: UpdatePayload<T>;
		params?: P;
		locale?: string;
		init?: FetchInit;
	}): Promise<Result<SelectedDoc<T, P>>> {
		const { payload, params, locale, init } = options;
		return this.single<SelectedDoc<T, P>>(`${this.uid}${this.query(params, locale)}`, {
			...init,
			method: "PUT",
			body: JSON.stringify(payload),
		});
	}

	/**
	 * `DELETE /api/<uid>`. With `locale`, deletes only that localization.
	 *
	 * Takes the `fields` and `populate` its route declares, and answers with the
	 * deleted document — or `null` when Strapi sends an empty body.
	 */
	async delete<const P extends WriteQueryParams<T> = object>(
		options: { params?: P; locale?: string; init?: FetchInit } = {}
	): Promise<Result<SelectedDoc<T, P> | null>> {
		const { params, locale, init } = options;
		const [err, body] = await this.http.request<StrapiSingleResponse<SelectedDoc<T, P>>>(
			`${this.uid}${this.query(params, locale)}`,
			{ ...init, method: "DELETE" }
		);
		if (err) return fail(err);
		const meta: StrapiMeta = body?.meta === undefined ? null : body.meta;
		return ok(body?.data ?? null, meta);
	}

	private async single<R>(path: string, init: FetchInit): Promise<Result<R>> {
		const [err, body] = await this.http.request<StrapiSingleResponse<R>>(path, init);
		if (err) return fail(err);
		if (!body?.data) return fail(NOT_FOUND);
		const meta: StrapiMeta = body.meta === undefined ? null : body.meta;
		return ok(body.data, meta);
	}
}
