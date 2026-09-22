import { fail, ok, type Result } from "../errors";
import type { HttpClient } from "../http";
import { buildQuery } from "../query";
import type { DeepPartial, FetchInit, QueryParams, StrapiUser } from "../types";
import type { ClientContext } from "./collection";

const NOT_FOUND = { status: 404, name: "NotFoundError", message: "Not Found" } as const;

/** Options common to read methods. */
interface ReadOptions<T> {
	/** Query parameters (filters, populate, sort, pagination). */
	params?: QueryParams<T>;
	/** Extra `fetch` options merged into the request. */
	init?: FetchInit;
}

/**
 * Client for the users-permissions plugin at `/api/users`.
 *
 * Unlike content types, these endpoints return plain arrays and objects (no
 * `data` wrapper), address users by numeric `id`, and ignore `locale`.
 */
export class UsersClient<T extends object = StrapiUser> {
	private readonly http: HttpClient;
	private readonly defaultLocale: string;

	/** Usually obtained via {@link Strapi.users} rather than constructed directly. */
	constructor(context: ClientContext) {
		this.http = context.http;
		this.defaultLocale = context.defaultLocale;
	}

	private query(params: QueryParams<T> | undefined): string {
		return buildQuery(params, { defaultLocale: this.defaultLocale });
	}

	/** `GET /api/users`. Lists users. */
	async findMany(options: ReadOptions<T> = {}): Promise<Result<T[]>> {
		const [err, body] = await this.http.request<T[]>(`users${this.query(options.params)}`, {
			...options.init,
			method: "GET",
		});
		if (err) return fail(err);
		return ok(Array.isArray(body) ? body : []);
	}

	/** `GET /api/users/<id>`. */
	async find(options: ReadOptions<T> & { id: number | string }): Promise<Result<T>> {
		return this.single(`users/${encodeURIComponent(String(options.id))}${this.query(options.params)}`, {
			...options.init,
			method: "GET",
		});
	}

	/** `GET /api/users/me`. The user the configured token belongs to. */
	async me(options: ReadOptions<T> = {}): Promise<Result<T>> {
		return this.single(`users/me${this.query(options.params)}`, { ...options.init, method: "GET" });
	}

	/** `GET /api/users/count`. */
	async count(options: ReadOptions<T> = {}): Promise<Result<number>> {
		const [err, body] = await this.http.request<number>(`users/count${this.query(options.params)}`, {
			...options.init,
			method: "GET",
		});
		if (err) return fail(err);
		return ok(typeof body === "number" ? body : 0);
	}

	/** `POST /api/users`. `data` is sent as the raw body (no `data` wrapper). */
	async create(options: { data: DeepPartial<T>; init?: FetchInit }): Promise<Result<T>> {
		return this.single("users", { ...options.init, method: "POST", body: JSON.stringify(options.data) });
	}

	/** `PUT /api/users/<id>`. */
	async update(options: { id: number | string; data: DeepPartial<T>; init?: FetchInit }): Promise<Result<T>> {
		return this.single(`users/${encodeURIComponent(String(options.id))}`, {
			...options.init,
			method: "PUT",
			body: JSON.stringify(options.data),
		});
	}

	/** `DELETE /api/users/<id>`. Returns the deleted user. */
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
