import { fail, ok, type Result, type ServiceError } from "./errors";
import type { HttpClient } from "./http";
import { mapWithConcurrency } from "./pool";
import { buildQuery } from "./query";
import type { FetchInit, QueryParams, StrapiPagination, StrapiResponse } from "./types";

export interface FetchAllOptions<T> {
	http: HttpClient;
	path: string;
	params?: QueryParams<T>;
	locale?: string;
	defaultLocale: string;
	concurrency: number;
	init?: FetchInit;
}

const DEFAULT_LIMIT = 25;

export async function fetchAll<T>(options: FetchAllOptions<T>): Promise<Result<T[]>> {
	const { http, path, params = {}, locale, defaultLocale, concurrency, init = {} } = options;
	const pagination = params.pagination ?? {};
	const offsetMode = pagination.start !== undefined || pagination.limit !== undefined;

	const getPage = async (page: QueryParams<T>["pagination"]): Promise<Result<StrapiResponse<T>>> => {
		const requestParams: QueryParams<T> = { ...params, ...(page !== undefined ? { pagination: page } : {}) };
		const query = buildQuery(requestParams, { defaultLocale, ...(locale !== undefined ? { locale } : {}) });
		const [err, body] = await http.request<StrapiResponse<T>>(`${path}${query}`, { ...init, method: "GET" });
		if (err) return fail(err);
		return ok(body ?? { data: [] });
	};

	const [firstErr, first] = await getPage(params.pagination);
	if (firstErr) return fail(firstErr);

	const meta = first.meta?.pagination;
	if (!meta) return ok(first.data, null);

	const rest: NonNullable<QueryParams<T>["pagination"]>[] = [];
	let start = 0;
	let limit = DEFAULT_LIMIT;

	if (offsetMode || "start" in meta) {
		start = pagination.start ?? ("start" in meta ? meta.start : 0);
		limit = pagination.limit ?? ("limit" in meta ? meta.limit : DEFAULT_LIMIT);
		for (let next = start + limit; next < meta.total; next += limit) {
			rest.push({ ...pagination, start: next, limit });
		}
	} else {
		const { page, pageCount, pageSize } = meta;
		for (let next = page + 1; next <= pageCount; next += 1) {
			rest.push({ ...pagination, page: next, pageSize });
		}
	}

	if (rest.length === 0) return ok(first.data, { pagination: meta });

	let failure: ServiceError | null = null;
	const pages = await mapWithConcurrency(rest, concurrency, async (p) => {
		const [err, body] = await getPage(p);
		if (err) {
			if (!failure) failure = err;
			return [];
		}
		return body.data;
	});
	if (failure) return fail(failure);

	const data = [...first.data, ...pages.flat()];
	const merged: StrapiPagination =
		offsetMode || "start" in meta
			? { start, limit, total: meta.total }
			: { page: 1, pageSize: data.length, pageCount: 1, total: meta.total };

	return ok(data, { pagination: merged });
}
