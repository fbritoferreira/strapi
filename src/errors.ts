import type { StrapiMeta } from "./types";

/** Error value returned as the first element of a {@link Result} tuple. Never thrown. */
export interface ServiceError {
	/** Human-readable description of what went wrong. */
	message: string;
	/** HTTP status when a response was received. */
	status?: number;
	/** Strapi error name (e.g. "ValidationError"), or "HTTPError", "TimeoutError", "NetworkError". */
	name?: string;
	/**
	 * Strapi `error.details`. Its shape varies by error, so it stays `unknown`;
	 * {@link validationIssues} reads the validation case safely.
	 */
	details?: unknown;
	/** Original thrown value for network errors. */
	cause?: unknown;
}

/**
 * One field-level problem inside a validation error.
 *
 * Strapi builds these the same way whether the route validated with yup or
 * zod, so `path`, `message` and `name` are always there; `value` only when the
 * validator captured what was rejected.
 */
export interface StrapiValidationIssue {
	/** Field the problem is on, e.g. `["seo", "metaTitle"]`. */
	path: (string | number)[];
	message: string;
	name: string;
	value?: unknown;
}

/** `error.details` of a validation error: the field problems, under `errors`. */
export interface StrapiValidationDetails {
	errors: StrapiValidationIssue[];
}

function isIssue(value: unknown): value is StrapiValidationIssue {
	if (typeof value !== "object" || value === null) return false;
	const issue = value as Record<string, unknown>;
	return Array.isArray(issue["path"]) && typeof issue["message"] === "string" && typeof issue["name"] === "string";
}

/**
 * Whether `details` carries field-level validation problems.
 *
 * Strapi puts several shapes in `details` — a rejected query param reports
 * `{ source, param }`, for instance — so this narrows rather than assumes.
 */
export function isValidationDetails(details: unknown): details is StrapiValidationDetails {
	if (typeof details !== "object" || details === null || Array.isArray(details)) return false;
	const errors = (details as Record<string, unknown>)["errors"];
	return Array.isArray(errors) && errors.every(isIssue);
}

/**
 * Field-level problems of an error, or an empty list when it carries none.
 *
 * @example
 * ```ts
 * const [err] = await articles.create({ payload: { data: {} } });
 * for (const issue of validationIssues(err)) {
 *   form.setError(issue.path.join("."), issue.message);
 * }
 * ```
 */
export function validationIssues(error: ServiceError | null | undefined): StrapiValidationIssue[] {
	if (!error || !isValidationDetails(error.details)) return [];
	return error.details.errors;
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
