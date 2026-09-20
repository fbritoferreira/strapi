import qs from "qs";

import type { QueryParams } from "./types";

export interface QueryOptions {
	locale?: string;
	defaultLocale: string;
}

export function buildQuery<T>(params: QueryParams<T> | undefined, options: QueryOptions): string {
	const merged: QueryParams<T> = { ...params };
	if (options.locale !== undefined) merged.locale = options.locale;
	if (merged.locale === options.defaultLocale) delete merged.locale;

	const query = qs.stringify(merged, { arrayFormat: "indices", encode: true });
	return query === "" ? "" : `?${query}`;
}
