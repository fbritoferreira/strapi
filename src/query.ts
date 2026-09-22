import qs from "qs";

import type { QueryParams } from "./types";

/** Locale handling for {@link buildQuery}. */
export interface QueryOptions {
	/** Locale to force onto the query, overriding `params.locale`. */
	locale?: string;
	/** Locale that is dropped from the query string because Strapi treats it as default. */
	defaultLocale: string;
}

/** Serialises {@link QueryParams} with `qs` (bracket/index array format) into `?…`, or `""` when empty. */
export function buildQuery<T>(params: QueryParams<T> | undefined, options: QueryOptions): string {
	const merged: QueryParams<T> = { ...params };
	if (options.locale !== undefined) merged.locale = options.locale;
	if (merged.locale === options.defaultLocale) delete merged.locale;

	const query = qs.stringify(merged, { arrayFormat: "indices", encode: true });
	return query === "" ? "" : `?${query}`;
}
