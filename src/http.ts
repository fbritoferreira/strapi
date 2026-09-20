import type { ServiceError } from "./errors";
import type { FetchInit, StrapiErrorBody } from "./types";

export interface HttpConfig {
	baseURL: string;
	token?: string;
	headers?: Record<string, string>;
	fetch?: typeof fetch;
	/** Milliseconds before a request is aborted. Default 10_000. */
	timeout?: number;
}

export type HttpResult<R> = [ServiceError, null] | [null, R | null];

const DEFAULT_TIMEOUT_MS = 10_000;

export class HttpClient {
	readonly baseURL: string;
	private readonly token: string | undefined;
	private readonly headers: Record<string, string>;
	private readonly fetchImpl: typeof fetch;
	private readonly timeout: number;

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
	}

	async request<R>(path: string, init: FetchInit = {}): Promise<HttpResult<R>> {
		const url = `${this.baseURL}/${path.replace(/^\/+/, "")}`;

		const headers = new Headers(this.headers);
		if (this.token) headers.set("Authorization", `Bearer ${this.token}`);
		if (typeof init.body === "string") headers.set("Content-Type", "application/json");
		new Headers(init.headers).forEach((value, key) => headers.set(key, value));

		const timeoutSignal = AbortSignal.timeout(this.timeout);
		const signal = init.signal ? AbortSignal.any([init.signal, timeoutSignal]) : timeoutSignal;

		let response: Response;
		try {
			response = await this.fetchImpl(url, { ...init, headers, signal });
		} catch (thrown) {
			return [toNetworkError(thrown, this.timeout), null];
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
}

function toNetworkError(thrown: unknown, timeout: number): ServiceError {
	if (thrown instanceof DOMException && thrown.name === "TimeoutError") {
		return { name: "TimeoutError", message: `Strapi API error: request timed out after ${timeout}ms`, cause: thrown };
	}
	const message = thrown instanceof Error ? thrown.message : String(thrown);
	return { name: "NetworkError", message, cause: thrown };
}

function toHttpError(response: Response, text: string): ServiceError {
	try {
		const body = JSON.parse(text) as Partial<StrapiErrorBody>;
		if (body && typeof body === "object" && body.error && typeof body.error.message === "string") {
			const error: ServiceError = {
				status: body.error.status ?? response.status,
				name: body.error.name,
				message: body.error.message,
			};
			if (body.error.details !== undefined) error.details = body.error.details;
			return error;
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
