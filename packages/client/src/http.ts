import { graphqlError, type ServiceError } from "./errors";
import { backoffFor, resolveRetry, retryAfterMs, shouldRetry, type ResolvedRetry, type RetryOptions } from "./retry";
import type { FetchInit, GraphqlError, RefreshedSession } from "./types";

/** Connection settings shared by every request. */
export interface HttpConfig {
	/** Strapi origin, e.g. `http://localhost:1337`. `/api` is appended when missing. */
	baseURL: string;
	/** API token or JWT sent as `Authorization: Bearer <token>`. */
	token?: string;
	/** Extra headers merged into every request. */
	headers?: Record<string, string>;
	/** Custom `fetch` implementation. Defaults to `globalThis.fetch`. */
	fetch?: typeof fetch;
	/** Milliseconds before a request is aborted. Default 10_000, per attempt. */
	timeout?: number;
	/**
	 * Repeat failed requests. A number is the extra attempts to make; an object
	 * tunes the backoff, statuses and methods. Off by default.
	 *
	 * @see {@link RetryOptions}
	 */
	retry?: number | RetryOptions;
	/**
	 * On a 401, rotate a users-permissions refresh token and retry the request
	 * once. Off by default. A 401 with no bearer token is left alone unless
	 * `cookie` is set.
	 */
	refreshOnUnauthorized?: RefreshOnUnauthorized;
}

/**
 * Opt-in refresh after a 401. The new JWT is adopted via {@link HttpClient.setToken}.
 * Concurrent 401s share one refresh, so a rotation is not issued once per request.
 */
export interface RefreshOnUnauthorized {
	/**
	 * Refresh token, or a getter for the current one. Omit when it travels in an
	 * httpOnly cookie (`cookie: true`).
	 */
	token?: string | (() => string | undefined);
	/**
	 * Send the refresh call with `credentials: "include"` and attempt it even
	 * when no bearer token is set. For an httpOnly refresh cookie.
	 */
	cookie?: boolean;
	/** Called once the rotation succeeds, so the new refresh token can be stored. */
	onRefresh?: (session: RefreshedSession) => void;
}

/** Low-level result of {@link HttpClient.request}: `[error, null]` or `[null, parsedBody | null]`. */
export type HttpResult<R> = [ServiceError, null] | [null, R | null];

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Thin `fetch` wrapper used by all sub-clients. Adds the bearer token, a
 * timeout, JSON parsing, and converts non-2xx responses and network failures
 * into {@link ServiceError} values instead of throwing.
 */
export class HttpClient {
	/** Normalised API root, always ending in `/api`. */
	readonly baseURL: string;
	private token: string | undefined;
	private readonly headers: Record<string, string>;
	private readonly fetchImpl: typeof fetch;
	private readonly timeout: number;
	private readonly retry: ResolvedRetry | null;
	private readonly refreshOnUnauthorized: RefreshOnUnauthorized | undefined;
	private refreshing: Promise<ServiceError | null> | null = null;

	constructor(config: HttpConfig) {
		if (typeof config.baseURL !== "string" || config.baseURL.trim() === "") {
			throw new TypeError("Strapi: baseURL is required");
		}
		let url = config.baseURL.trim().replace(/\/+$/, "");
		if (!url.endsWith("/api")) url += "/api";
		this.baseURL = url;
		this.token = config.token;
		this.headers = config.headers ?? {};
		this.fetchImpl = config.fetch ?? ((input, init) => globalThis.fetch(input, init));
		this.timeout = config.timeout ?? DEFAULT_TIMEOUT_MS;
		this.retry = resolveRetry(config.retry);
		this.refreshOnUnauthorized = config.refreshOnUnauthorized;
	}

	/**
	 * Waits out the backoff before another attempt, when the policy calls for
	 * one. An aborted caller signal stops the retrying: the caller asked for
	 * the request to stop, not to be repeated.
	 *
	 * @returns whether to make another attempt.
	 */
	private async waitToRetry(
		method: string,
		status: number | null,
		headers: Headers | null,
		made: number,
		signal: AbortSignal | null | undefined
	): Promise<boolean> {
		// Read through a function: the signal can abort while we wait, which
		// narrowing from an earlier check would hide.
		const aborted = () => signal?.aborted === true;
		if (this.retry === null) return false;
		if (aborted()) return false;
		if (!shouldRetry(this.retry, method, status, made)) return false;

		const delay = backoffFor(this.retry, made, headers === null ? null : retryAfterMs(headers, Date.now()));
		this.retry.onRetry?.({ attempt: made + 1, delay, status });
		await new Promise<void>((resolve) => {
			const done = () => {
				clearTimeout(timer);
				signal?.removeEventListener("abort", done);
				resolve();
			};
			const timer = setTimeout(done, delay);
			signal?.addEventListener("abort", done);
		});
		return !aborted();
	}

	/** Replaces the bearer token sent with every request; `undefined` clears it. */
	setToken(token: string | undefined): void {
		this.token = token;
	}

	/**
	 * Performs one request against `baseURL/path`.
	 *
	 * @param path Path relative to the API root, e.g. `articles?populate=*`, or an absolute `http(s)` URL.
	 * @param init Standard `fetch` options; `headers` are merged over the configured defaults.
	 * @returns The parsed JSON body, `null` for an empty body, or a {@link ServiceError}.
	 */
	async request<R>(path: string, init: FetchInit = {}): Promise<HttpResult<R>> {
		return this.dispatch(path, init, false);
	}

	private async dispatch<R>(path: string, init: FetchInit, refreshed: boolean): Promise<HttpResult<R>> {
		const absolute = /^https?:\/\//i.test(path);
		const url = absolute ? path : `${this.baseURL}/${path.replace(/^\/+/, "")}`;

		const headers = new Headers(this.headers);
		// The token is for Strapi alone, not for an absolute URL elsewhere such as a media bucket.
		if (this.token && (!absolute || new URL(url).origin === new URL(this.baseURL).origin)) {
			headers.set("Authorization", `Bearer ${this.token}`);
		}
		if (typeof init.body === "string") headers.set("Content-Type", "application/json");
		new Headers(init.headers).forEach((value, key) => headers.set(key, value));

		const method = init.method ?? "GET";
		let made = 0;
		let response: Response;

		// Each attempt gets its own timeout: the budget is per request, not
		// shared across retries.
		for (;;) {
			const timeoutSignal = AbortSignal.timeout(this.timeout);
			const signal = init.signal ? AbortSignal.any([init.signal, timeoutSignal]) : timeoutSignal;

			try {
				response = await this.fetchImpl(url, { ...init, headers, signal });
			} catch (thrown) {
				const error = toNetworkError(thrown, this.timeout);
				if (await this.waitToRetry(method, null, null, made, init.signal)) {
					made += 1;
					continue;
				}
				return [error, null];
			}

			if (!response.ok && (await this.waitToRetry(method, response.status, response.headers, made, init.signal))) {
				made += 1;
				continue;
			}
			break;
		}

		const refresh = this.refreshOnUnauthorized;
		if (
			!response.ok &&
			response.status === 401 &&
			!refreshed &&
			refresh !== undefined &&
			init.signal?.aborted !== true &&
			this.shouldRefresh(path, refresh)
		) {
			const refreshErr = await this.refreshUnauthorized(refresh, init.signal);
			if (refreshErr) return [refreshErr, null];
			return this.dispatch(path, init, true);
		}

		const text = await response.text();

		if (!response.ok) {
			return [toHttpError(response, text), null];
		}
		if (text === "") {
			return [null, null];
		}
		try {
			return [null, JSON.parse(text) as R];
		} catch (thrown) {
			return [
				{
					name: "HTTPError",
					status: response.status,
					message: `Strapi API error: Failed to parse JSON response - ${(thrown as Error).message}`,
				},
				null,
			];
		}
	}

	private shouldRefresh(path: string, options: RefreshOnUnauthorized): boolean {
		if (isRefreshPath(path)) return false;
		if (options.cookie === true) return true;
		return typeof this.token === "string" && this.token !== "";
	}

	/**
	 * Joins the shared rotation. It runs on its own timeout, not on any one
	 * caller's signal, so an abort only stops the waiter that aborted.
	 */
	private refreshUnauthorized(
		options: RefreshOnUnauthorized,
		signal: AbortSignal | null | undefined
	): Promise<ServiceError | null> {
		const refreshing = (this.refreshing ??= this.rotate(options).finally(() => {
			this.refreshing = null;
		}));
		if (!signal) return refreshing;
		return new Promise((resolve, reject) => {
			const onAbort = () => resolve(toNetworkError(signal.reason, this.timeout));
			signal.addEventListener("abort", onAbort, { once: true });
			refreshing.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
		});
	}

	private async rotate(options: RefreshOnUnauthorized): Promise<ServiceError | null> {
		const provided = typeof options.token === "function" ? options.token() : options.token;
		const hasToken = typeof provided === "string" && provided !== "";
		if (!hasToken && options.cookie !== true) {
			return { name: "HTTPError", message: "Strapi: no refresh token to rotate" };
		}

		const headers = new Headers(this.headers);
		headers.set("Content-Type", "application/json");

		let response: Response;
		try {
			response = await this.fetchImpl(`${this.baseURL}/auth/refresh`, {
				method: "POST",
				headers,
				body: JSON.stringify(hasToken ? { refreshToken: provided } : {}),
				signal: AbortSignal.timeout(this.timeout),
				...(options.cookie === true && { credentials: "include" as const }),
			});
		} catch (thrown) {
			return toNetworkError(thrown, this.timeout);
		}

		const text = await response.text();
		if (!response.ok) {
			const error = toHttpError(response, text);
			if (error.status === 404) {
				return { ...error, message: REFRESH_MODE_HINT };
			}
			return error;
		}

		let body: RefreshedSession | null;
		try {
			body = text === "" ? null : (JSON.parse(text) as RefreshedSession);
		} catch (thrown) {
			return {
				name: "HTTPError",
				status: response.status,
				message: "Strapi: refresh answered with invalid JSON",
				cause: thrown,
			};
		}
		if (!body?.jwt) return { name: "HTTPError", message: "Strapi: refresh answered with an empty body" };

		this.setToken(body.jwt);
		try {
			options.onRefresh?.(body);
		} catch (thrown) {
			const message = thrown instanceof Error ? thrown.message : String(thrown);
			return { name: "HTTPError", message, cause: thrown };
		}
		return null;
	}
}

const REFRESH_MODE_HINT =
	'Strapi: no refresh endpoint; set plugin::users-permissions.jwtManagement to "refresh" to enable refresh tokens';

function isRefreshPath(path: string): boolean {
	const pathname = /^https?:\/\//i.test(path) ? new URL(path).pathname : `/${path}`;
	return pathname.replace(/\/+$/, "").endsWith("/auth/refresh");
}

function toNetworkError(thrown: unknown, timeout: number): ServiceError {
	if (thrown instanceof DOMException && thrown.name === "TimeoutError") {
		return { name: "TimeoutError", message: `Strapi API error: request timed out after ${timeout}ms`, cause: thrown };
	}
	const message = thrown instanceof Error ? thrown.message : String(thrown);
	return { name: "NetworkError", message, cause: thrown };
}

/** `StrapiErrorBody["error"]`, but `name` may be missing on a malformed or non-conforming response body. */
interface ParsedErrorBody {
	error?: {
		status?: number;
		name?: string;
		message: string;
		details?: unknown;
	};
	/** A GraphQL error response, e.g. a 400 for a query that does not validate. */
	errors?: GraphqlError[];
}

function toHttpError(response: Response, text: string): ServiceError {
	try {
		const body = JSON.parse(text) as ParsedErrorBody;
		if (body && typeof body === "object" && body.error && typeof body.error.message === "string") {
			const error: ServiceError = {
				status: body.error.status ?? response.status,
				name: body.error.name ?? "HTTPError",
				message: body.error.message,
			};
			if (body.error.details !== undefined) error.details = body.error.details;
			return error;
		}
		if (body && typeof body === "object" && Array.isArray(body.errors) && typeof body.errors[0]?.message === "string") {
			return { status: response.status, ...graphqlError(body.errors) };
		}
	} catch {
		// not JSON, fall through
	}
	return {
		status: response.status,
		name: "HTTPError",
		message: `Strapi API error: ${response.status} ${response.statusText}`.trim(),
	};
}
