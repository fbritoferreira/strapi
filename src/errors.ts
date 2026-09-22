import type { StrapiMeta } from "./types";

/** Error value returned as the first element of a {@link Result} tuple. Never thrown. */
export interface ServiceError {
	/** Human-readable description of what went wrong. */
	message: string;
	/** HTTP status when a response was received. */
	status?: number;
	/** Strapi error name (e.g. "ValidationError"), or "HTTPError", "TimeoutError", "NetworkError". */
	name?: string;
	/** Strapi `error.details`, e.g. per-field validation errors. */
	details?: unknown;
	/** Original thrown value for network errors. */
	cause?: unknown;
}

/**
 * Return type of every client method: `[error, data, meta]`.
 *
 * Exactly one of `error` and `data` is non-null, so a single `if (err)` check
 * narrows `data` to `T`.
 *
 * @example
 * ```ts
 * const [err, articles, meta] = await strapi.collection<Article>("articles").findMany();
 * if (err) throw new Error(err.message);
 * console.log(articles.length, meta?.pagination?.total);
 * ```
 */
export type Result<T> = [ServiceError, null, null] | [null, T, StrapiMeta];

/** Builds a successful {@link Result}. */
export function ok<T>(data: T, meta: StrapiMeta = null): Result<T> {
	return [null, data, meta];
}

/** Builds a failed {@link Result}. */
export function fail<T = never>(error: ServiceError): Result<T> {
	return [error, null, null];
}
