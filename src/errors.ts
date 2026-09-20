import type { StrapiMeta } from "./types";

export interface ServiceError {
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

export type Result<T> = [ServiceError, null, null] | [null, T, StrapiMeta];

export function ok<T>(data: T, meta: StrapiMeta = null): Result<T> {
	return [null, data, meta];
}

export function fail<T = never>(error: ServiceError): Result<T> {
	return [error, null, null];
}
