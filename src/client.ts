import qs from "qs";

import type {
	CreatePayload,
	QueryParams,
	StrapiFilters,
	StrapiResponse,
	StrapiSingleResponse,
	UpdatePayload,
} from "./types";

interface ServiceError {
	message: string;
	status?: number;
}

export class StrapiClient<
	T extends { id: number | string; documentId?: string }
> {
	private readonly baseURL: string;
	private readonly headers: HeadersInit;
	private readonly uid: string;

	constructor({
		baseURL,
		uid,
		token,
	}: {
		baseURL: string;
		uid: string;
		token?: string;
	}) {
		let apiUrl = baseURL.replace(/\/+$/, "");
		if (!apiUrl.endsWith("/api")) {
			apiUrl += "/api";
		}
		this.baseURL = apiUrl;
		this.headers = {
			"Content-Type": "application/json",
			...(token && { Authorization: `Bearer ${token}` }),
		};
		this.uid = uid;
	}

	private async request<R>(
		endpoint: string,
		options: RequestInit = {}
	): Promise<[ServiceError | null, R | null]> {
		const normalizedEndpoint = endpoint.replace(/^\/+/, "");
		const url = `${this.baseURL}/${normalizedEndpoint}`;
		try {
			const response = await fetch(url, {
				...options,
				headers: { ...this.headers, ...options.headers },
			});
			if (!response.ok) {
				return [
					{
						message: `Strapi API error: ${response.status} ${response.statusText}`,
						status: response.status,
					},
					null,
				];
			}
			let data: R;
			try {
				data = (await response.json()) as R;
			} catch (jsonError) {
				if (options.method === "DELETE") {
					data = { data: null } as R;
				} else {
					return [
						{
							message: `Strapi API error: Failed to parse JSON response - ${
								(jsonError as Error).message
							}`,
							status: response.status,
						},
						null,
					];
				}
			}
			return [null, data];
		} catch (error) {
			return [
				{
					message: `Strapi API error: ${(error as Error).message}`,
				},
				null,
			];
		}
	}

	private getQueryString(params?: QueryParams<T>): string {
		if (!params || Object.keys(params).length === 0) return "";
		return `?${qs.stringify(params, {
			addQueryPrefix: false,
			arrayFormat: "indices",
			encode: true,
		})}`;
	}

	async findMany(
		params?: QueryParams<T>,
		locale?: string
	): Promise<[ServiceError | null, T[] | null]> {
		const queryParams = {
			...params,
			...(locale && locale !== "en" ? { locale } : {}),
		};
		const queryString = this.getQueryString(queryParams);
		const [err, response] = await this.request<StrapiResponse<T>>(
			`${this.uid}${queryString}`,
			{ method: "GET" }
		);
		if (err) return [err, null];
		return [null, response?.data ?? []];
	}

	async find(options: {
		id?: number | string;
		params?: QueryParams<T>;
		locale?: string;
	}): Promise<[ServiceError | null, T | null]> {
		const { id, params, locale } = options;
		const queryParams = {
			...params,
			...(locale && locale !== "en" ? { locale } : {}),
		};
		const queryString = this.getQueryString(queryParams);
		let err: ServiceError | null = null;
		let response: StrapiSingleResponse<T> | null = null;
		if (id) {
			[err, response] = await this.request<StrapiSingleResponse<T>>(
				`${this.uid}/${id}${queryString}`,
				{ method: "GET" }
			);
		} else {
			const [findErr, findResponse] = await this.findMany(params, locale);
			if (findErr) return [findErr, null];
			return [null, findResponse?.[0] ?? null];
		}
		if (err) return [err, null];
		return [null, response?.data ?? null];
	}

	async create(options: {
		payload: CreatePayload<T>;
		params?: Omit<QueryParams<T>, "filters">;
		locale?: string;
		filters?: StrapiFilters<T>;
	}): Promise<[ServiceError | null, T | null]> {
		const { payload, params = {}, filters, locale = "en" } = options;
		const isDefaultLocale = locale === "en";

		if (isDefaultLocale) {
			// Create default locale entry straightforwardly
			const [err, response] = await this.request<StrapiSingleResponse<T>>(
				this.uid,
				{
					method: "POST",
					body: JSON.stringify(payload),
				}
			);
			if (err) return [err, null];
			return [null, response?.data ?? null];
		}

		// For non-default locales: ensure default locale entry exists first
		const searchParams: QueryParams<T> = {
			...params,
			...(filters ? { filters } : {}),
			locale: "en",
		};
		const searchQuery = this.getQueryString(searchParams);
		const [searchErr, enResponse] = await this.request<StrapiResponse<T>>(
			`${this.uid}${searchQuery}`
		);
		if (searchErr) return [searchErr, null];

		let baseId: string | null = null;
		if (
			enResponse?.data &&
			enResponse.data.length > 0 &&
			enResponse.data[0] &&
			enResponse.data[0].documentId
		) {
			baseId = enResponse.data[0].documentId;
		} else {
			const [createErr, createResponse] = await this.request<
				StrapiSingleResponse<T>
			>(this.uid, {
				method: "POST",
				body: JSON.stringify({
					...payload,
					data: { ...payload.data, locale: "en" },
				}),
			});
			if (createErr || !createResponse?.data.documentId) {
				return [createErr, null];
			}
			baseId = createResponse.data.documentId;
		}

		// Create localized entry by POSTing to /localizations endpoint
		// Include locale in the payload explicitly
		const [localeErr, localeResponse] = await this.request<
			StrapiSingleResponse<T>
		>(`${this.uid}/${baseId}?locale=${locale}`, {
			method: "PUT",
			body: JSON.stringify(payload),
		});

		if (localeErr || !localeResponse?.data.documentId) {
			return [localeErr, null];
		}

		return [null, localeResponse.data];
	}

	async update(options: {
		id: number | string;
		payload: UpdatePayload<T>;
		params?: QueryParams<T>;
		locale?: string;
	}): Promise<[ServiceError | null, T | null]> {
		const { id, payload, locale = "en" } = options;

		const url =
			locale === "en"
				? `${this.uid}/${id}`
				: `${this.uid}/${id}?locale=${locale}`;

		const [err, response] = await this.request<StrapiSingleResponse<T>>(url, {
			method: "PUT",
			body: JSON.stringify(payload),
		});

		if (err) {
			return [err, null];
		}
		return [null, response?.data ?? null];
	}

	async delete(options: {
		id: number | string;
	}): Promise<[ServiceError | null, T | null]> {
		const [err, response] = await this.request<StrapiSingleResponse<T>>(
			`${this.uid}/${options.id}`,
			{ method: "DELETE" }
		);
		if (err) {
			return [err, null];
		}
		return [null, response?.data ?? null];
	}

	async upsert(options: {
		payload: CreatePayload<T>;
		filters?: StrapiFilters<T>;
		params?: Omit<QueryParams<T>, "filters">;
		locale?: string;
	}): Promise<[ServiceError | null, T | null]> {
		const { payload, filters, params = {}, locale = "en" } = options;

		const searchParams: QueryParams<T> = {
			...params,
			...(filters ? { filters } : {}),
			pagination: { pageSize: 1 },
			...(locale && locale !== "en" ? { locale } : {}),
		};
		const [searchErr, searchResponse] = await this.findMany(
			searchParams,
			locale
		);
		if (searchErr) return [searchErr, null];

		if (searchResponse && searchResponse.length > 0 && searchResponse?.[0]) {
			const existingId =
				searchResponse?.[0].documentId ?? searchResponse?.[0].id;

			return this.update({
				id: existingId,
				payload: payload as UpdatePayload<T>,
				params,
				locale,
			});
		}
		return this.create({
			payload,
			params,
			...(filters ? { filters } : {}),
			locale,
		});
	}
}
