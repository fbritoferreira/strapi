import qs from "qs";

import type { FetchInit } from "./types";

/** A route key (`"POST /auth/local"`) turned into a path and `fetch` options. */
export interface RouteRequest {
	path: string;
	init: FetchInit;
}

const PLACEHOLDER = /\{([A-Za-z0-9_]+)\}/g;

/**
 * Builds the request for one {@link StrapiRoutes} key: substitutes `{param}`
 * placeholders, appends the serialised query, and attaches the JSON body.
 *
 * @throws {TypeError} when the path declares a param the caller did not pass.
 */
export function buildRoutePath(key: string, options: Record<string, unknown> | undefined): RouteRequest {
	const space = key.indexOf(" ");
	const method = key.slice(0, space);
	const template = key.slice(space + 1);
	const params = (options?.["params"] ?? {}) as Record<string, string | number>;

	const path = template.replace(PLACEHOLDER, (_match, name: string) => {
		const value = params[name];
		if (value === undefined) throw new TypeError(`Strapi: route "${key}" needs the path param "${name}"`);
		return encodeURIComponent(String(value));
	});

	const query = options?.["query"];
	const search = query === undefined ? "" : qs.stringify(query, { arrayFormat: "indices", encode: true });
	const body = options?.["body"];
	const init = (options?.["init"] ?? {}) as FetchInit;

	return {
		path: search === "" ? path : `${path}?${search}`,
		init: { ...init, method, ...(body !== undefined && { body: JSON.stringify(body) }) },
	};
}
