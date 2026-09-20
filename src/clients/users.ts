import { fail, ok, type Result } from "../errors";
import type { HttpClient } from "../http";
import { buildQuery } from "../query";
import type { DeepPartial, FetchInit, QueryParams, StrapiUser } from "../types";
import type { ClientContext } from "./collection";

const NOT_FOUND = { status: 404, name: "NotFoundError", message: "Not Found" } as const;

interface ReadOptions<T> {
	params?: QueryParams<T>;
	init?: FetchInit;
}

/** users-permissions `/api/users`: plain bodies, numeric ids, no locale. */
export class UsersClient<T extends object = StrapiUser> {
	private readonly http: HttpClient;
	private readonly defaultLocale: string;

	constructor(context: ClientContext) {
		this.http = context.http;
		this.defaultLocale = context.defaultLocale;
	}

	private query(params: QueryParams<T> | undefined): string {
		return buildQuery(params, { defaultLocale: this.defaultLocale });
	}

	async findMany(options: ReadOptions<T> = {}): Promise<Result<T[]>> {
		const [err, body] = await this.http.request<T[]>(`users${this.query(options.params)}`, {
			...options.init,
			method: "GET",
		});
		if (err) return fail(err);
		return ok(Array.isArray(body) ? body : []);
	}

	async find(options: ReadOptions<T> & { id: number | string }): Promise<Result<T>> {
		return this.single(`users/${encodeURIComponent(String(options.id))}${this.query(options.params)}`, {
			...options.init,
			method: "GET",
		});
	}

	async me(options: ReadOptions<T> = {}): Promise<Result<T>> {
		return this.single(`users/me${this.query(options.params)}`, { ...options.init, method: "GET" });
	}

	async count(options: ReadOptions<T> = {}): Promise<Result<number>> {
		const [err, body] = await this.http.request<number>(`users/count${this.query(options.params)}`, {
			...options.init,
			method: "GET",
		});
		if (err) return fail(err);
		return ok(typeof body === "number" ? body : 0);
	}

	async create(options: { data: DeepPartial<T>; init?: FetchInit }): Promise<Result<T>> {
		return this.single("users", { ...options.init, method: "POST", body: JSON.stringify(options.data) });
	}

	async update(options: { id: number | string; data: DeepPartial<T>; init?: FetchInit }): Promise<Result<T>> {
		return this.single(`users/${encodeURIComponent(String(options.id))}`, {
			...options.init,
			method: "PUT",
			body: JSON.stringify(options.data),
		});
	}

	async delete(options: { id: number | string; init?: FetchInit }): Promise<Result<T>> {
		return this.single(`users/${encodeURIComponent(String(options.id))}`, { ...options.init, method: "DELETE" });
	}

	private async single(path: string, init: FetchInit): Promise<Result<T>> {
		const [err, body] = await this.http.request<T>(path, init);
		if (err) return fail(err);
		if (!body) return fail(NOT_FOUND);
		return ok(body);
	}
}
