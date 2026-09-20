import { fail, ok, type Result } from "../errors";
import type { HttpClient } from "../http";
import { buildQuery } from "../query";
import type { FetchInit, QueryParams, StrapiMeta, StrapiSingleResponse, UpdatePayload } from "../types";
import type { ClientContext } from "./collection";

const NOT_FOUND = { status: 404, name: "NotFoundError", message: "Not Found" } as const;

export class SingleTypeClient<T extends object> {
	private readonly http: HttpClient;
	private readonly defaultLocale: string;
	readonly uid: string;

	constructor(context: ClientContext, uid: string) {
		this.http = context.http;
		this.defaultLocale = context.defaultLocale;
		this.uid = uid;
	}

	private query(params: QueryParams<T> | undefined, locale: string | undefined): string {
		return buildQuery(params, { defaultLocale: this.defaultLocale, ...(locale !== undefined && { locale }) });
	}

	async find(options: { params?: QueryParams<T>; locale?: string; init?: FetchInit } = {}): Promise<Result<T>> {
		const { params, locale, init } = options;
		return this.single(`${this.uid}${this.query(params, locale)}`, { ...init, method: "GET" });
	}

	async update(options: {
		payload: UpdatePayload<T>;
		params?: QueryParams<T>;
		locale?: string;
		init?: FetchInit;
	}): Promise<Result<T>> {
		const { payload, params, locale, init } = options;
		return this.single(`${this.uid}${this.query(params, locale)}`, {
			...init,
			method: "PUT",
			body: JSON.stringify(payload),
		});
	}

	async delete(options: { locale?: string; init?: FetchInit } = {}): Promise<Result<null>> {
		const { locale, init } = options;
		const [err] = await this.http.request<unknown>(`${this.uid}${this.query(undefined, locale)}`, {
			...init,
			method: "DELETE",
		});
		if (err) return fail(err);
		return ok(null);
	}

	private async single(path: string, init: FetchInit): Promise<Result<T>> {
		const [err, body] = await this.http.request<StrapiSingleResponse<T>>(path, init);
		if (err) return fail(err);
		if (!body?.data) return fail(NOT_FOUND);
		const meta: StrapiMeta = body.meta === undefined ? null : body.meta;
		return ok(body.data, meta);
	}
}
