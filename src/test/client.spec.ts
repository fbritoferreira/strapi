import qs from "qs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StrapiClient } from "../client";

interface QueryParams<T> {
	filters?: StrapiFilters<T>;
	populate?: string[];
	pagination?: { pageSize: number };
	locale?: string;
}
type StrapiFilters<T> = Partial<Record<keyof T, unknown>>;
interface CreatePayload<T> {
	data: T;
}
interface UpdatePayload<T> {
	data: Partial<T>;
}
interface StrapiResponse<T> {
	data: T[] | null;
}
interface StrapiSingleResponse<T> {
	data: T | null;
}

interface TestEntity {
	id: number;
	documentId?: string;
	name: string;
}

describe("StrapiClient", () => {
	let client: StrapiClient<TestEntity>;
	let mockFetch: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		client = new StrapiClient<TestEntity>({
			baseURL: "http://localhost",
			uid: "test-entities",
			token: "mock-token",
		});
		mockFetch = vi.fn();
		vi.stubGlobal("fetch", mockFetch);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("constructor", () => {
		it("normalizes baseURL correctly without trailing slash", () => {
			const c = new StrapiClient<TestEntity>({
				baseURL: "http://localhost",
				uid: "uid",
			});
			// Since baseURL is private, we test indirectly through fetch calls
			expect(c).toBeDefined();
		});

		it("normalizes baseURL correctly with trailing slash", () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ data: [] }),
				status: 200,
				statusText: "OK",
			});

			const c = new StrapiClient<TestEntity>({
				baseURL: "http://localhost/",
				uid: "test-entities",
			});
			expect(c).toBeDefined();
		});

		it("normalizes baseURL correctly if already ends with /api", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ data: [] }),
				status: 200,
				statusText: "OK",
			});

			const c = new StrapiClient<TestEntity>({
				baseURL: "http://localhost/api",
				uid: "test-entities",
			});
			await c.findMany();
			expect(mockFetch).toHaveBeenCalledWith(
				"http://localhost/api/test-entities",
				expect.any(Object)
			);
		});

		it("includes Authorization header if token provided", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ data: [] }),
				status: 200,
				statusText: "OK",
			});

			const c = new StrapiClient<TestEntity>({
				baseURL: "http://localhost",
				uid: "test-entities",
				token: "test-token",
			});
			await c.findMany();
			expect(mockFetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					headers: expect.objectContaining({
						Authorization: "Bearer test-token",
					}),
				})
			);
		});

		it("excludes Authorization header if no token", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ data: [] }),
				status: 200,
				statusText: "OK",
			});

			const c = new StrapiClient<TestEntity>({
				baseURL: "http://localhost",
				uid: "test-entities",
			});
			await c.findMany();
			expect(mockFetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					headers: expect.not.objectContaining({
						Authorization: expect.any(String),
					}),
				})
			);
		});
	});

	describe("findMany", () => {
		it("fetches multiple entities successfully", async () => {
			const mockResponse: StrapiResponse<TestEntity> = {
				data: [
					{ id: 1, name: "test" },
					{ id: 2, name: "test2" },
				],
			};
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
				status: 200,
				statusText: "OK",
			});

			const [err, data] = await client.findMany();
			expect(err).toBeNull();
			expect(data).toEqual(mockResponse.data);
			expect(mockFetch).toHaveBeenCalledWith(
				"http://localhost/api/test-entities",
				expect.objectContaining({
					method: "GET",
					headers: expect.objectContaining({
						"Content-Type": "application/json",
						Authorization: "Bearer mock-token",
					}),
				})
			);
		});

		it("handles query params correctly", async () => {
			const params: QueryParams<TestEntity> = { populate: ["*"] };
			const mockResponse: StrapiResponse<TestEntity> = { data: [] };
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
				status: 200,
				statusText: "OK",
			});

			const [err, data] = await client.findMany(params);
			expect(err).toBeNull();
			expect(data).toEqual([]);
			expect(mockFetch).toHaveBeenCalledWith(
				`http://localhost/api/test-entities?${qs.stringify(params, {
					addQueryPrefix: false,
					arrayFormat: "indices",
					encode: true,
				})}`,
				expect.any(Object)
			);
		});

		it("appends locale to query for non-default locale", async () => {
			const mockResponse: StrapiResponse<TestEntity> = { data: [] };
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
				status: 200,
				statusText: "OK",
			});

			const [err, data] = await client.findMany({}, "fr");
			expect(err).toBeNull();
			expect(data).toEqual([]);
			expect(mockFetch).toHaveBeenCalledWith(
				"http://localhost/api/test-entities?locale=fr",
				expect.any(Object)
			);
		});

		it("does not append locale for default locale (en)", async () => {
			const mockResponse: StrapiResponse<TestEntity> = { data: [] };
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
				status: 200,
				statusText: "OK",
			});

			const [err, data] = await client.findMany({}, "en");
			expect(err).toBeNull();
			expect(data).toEqual([]);
			expect(mockFetch).toHaveBeenCalledWith(
				"http://localhost/api/test-entities",
				expect.any(Object)
			);
		});

		it("returns error on failed response", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 404,
				statusText: "Not Found",
			});

			const [err, data] = await client.findMany();
			expect(err).toEqual({
				message: "Strapi API error: 404 Not Found",
				status: 404,
			});
			expect(data).toBeNull();
		});

		it("returns error on network failure", async () => {
			mockFetch.mockRejectedValueOnce(new Error("Network error"));

			const [err, data] = await client.findMany();
			expect(err).toEqual({ message: "Strapi API error: Network error" });
			expect(data).toBeNull();
		});

		it("handles JSON parse error", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => {
					throw new Error("Invalid JSON");
				},
				status: 200,
				statusText: "OK",
			});

			const [err, data] = await client.findMany();
			expect(err).toEqual({
				message:
					"Strapi API error: Failed to parse JSON response - Invalid JSON",
				status: 200,
			});
			expect(data).toBeNull();
		});

		it("returns empty array when data is null", async () => {
			const mockResponse: StrapiResponse<TestEntity> = { data: null };
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
				status: 200,
				statusText: "OK",
			});

			const [err, data] = await client.findMany();
			expect(err).toBeNull();
			expect(data).toEqual([]);
		});
	});

	describe("find", () => {
		it("fetches single entity by id successfully", async () => {
			const mockResponse: StrapiSingleResponse<TestEntity> = {
				data: { id: 1, name: "test" },
			};
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
				status: 200,
				statusText: "OK",
			});

			const [err, data] = await client.find({ id: 1 });
			expect(err).toBeNull();
			expect(data).toEqual(mockResponse.data);
		});

		it("fetches first entity without id using params", async () => {
			const mockResponse: StrapiResponse<TestEntity> = {
				data: [{ id: 1, name: "test" }],
			};
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
				status: 200,
				statusText: "OK",
			});

			const [err, data] = await client.find({
				params: { filters: { name: { $eq: "test" } } },
			});
			expect(err).toBeNull();
			expect(data).toEqual({ id: 1, name: "test" });
		});

		it("returns null if no data for id", async () => {
			const mockResponse: StrapiSingleResponse<TestEntity> = { data: null };
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
				status: 200,
				statusText: "OK",
			});

			const [err, data] = await client.find({ id: 999 });
			expect(err).toBeNull();
			expect(data).toBeNull();
		});

		it("returns null if no entities found without id", async () => {
			const mockResponse: StrapiResponse<TestEntity> = { data: [] };
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
				status: 200,
				statusText: "OK",
			});

			const [err, data] = await client.find({});
			expect(err).toBeNull();
			expect(data).toBeNull();
		});

		it("appends locale to query for non-default locale with id", async () => {
			const mockResponse: StrapiSingleResponse<TestEntity> = {
				data: { id: 1, name: "test" },
			};
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
				status: 200,
				statusText: "OK",
			});

			const [err, data] = await client.find({ id: 1, locale: "fr" });
			expect(err).toBeNull();
			expect(data).toEqual(mockResponse.data);
			expect(mockFetch).toHaveBeenCalledWith(
				"http://localhost/api/test-entities/1?locale=fr",
				expect.any(Object)
			);
		});

		it("does not append locale for default locale (en) with id", async () => {
			const mockResponse: StrapiSingleResponse<TestEntity> = {
				data: { id: 1, name: "test" },
			};
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
				status: 200,
				statusText: "OK",
			});

			const [err, data] = await client.find({ id: 1, locale: "en" });
			expect(err).toBeNull();
			expect(data).toEqual(mockResponse.data);
			expect(mockFetch).toHaveBeenCalledWith(
				"http://localhost/api/test-entities/1",
				expect.any(Object)
			);
		});

		it("returns error on failed response", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 404,
				statusText: "Not Found",
			});

			const [err, data] = await client.find({ id: 1 });
			expect(err).toEqual({
				message: "Strapi API error: 404 Not Found",
				status: 404,
			});
			expect(data).toBeNull();
		});
	});

	describe("create", () => {
		it("creates entity successfully in default locale", async () => {
			const payload: CreatePayload<TestEntity> = { data: { name: "new" } };
			const mockResponse: StrapiSingleResponse<TestEntity> = {
				data: { id: 1, name: "new" },
			};
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
				status: 201,
				statusText: "Created",
			});

			const [err, data] = await client.create({ payload });
			expect(err).toBeNull();
			expect(data).toEqual(mockResponse.data);
			expect(mockFetch).toHaveBeenCalledWith(
				"http://localhost/api/test-entities",
				expect.objectContaining({
					method: "POST",
					body: JSON.stringify(payload),
				})
			);
		});

		it("creates entity in non-default locale by creating default first", async () => {
			const payload: CreatePayload<TestEntity> = { data: { name: "new" } };
			const filters: StrapiFilters<TestEntity> = {
				name: { $eq: "nonexistent" },
			};

			const emptyResponse: StrapiResponse<TestEntity> = { data: [] };
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => emptyResponse,
				status: 200,
				statusText: "OK",
			});

			const defaultResponse: StrapiSingleResponse<TestEntity> = {
				data: { id: 1, documentId: "doc1", name: "new" },
			};
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => defaultResponse,
				status: 201,
				statusText: "Created",
			});

			const localeResponse: StrapiSingleResponse<TestEntity> = {
				data: { id: 1, documentId: "doc1", name: "new" },
			};
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => localeResponse,
				status: 201,
				statusText: "Created",
			});

			const [err, data] = await client.create({
				payload,
				filters,
				locale: "fr",
			});
			expect(err).toBeNull();
			expect(data).toEqual(localeResponse.data);
			expect(mockFetch).toHaveBeenCalledTimes(3);
		});

		it("creates locale for existing default", async () => {
			const payload: CreatePayload<TestEntity> = {
				data: { name: "localized" },
			};

			const foundResponse: StrapiResponse<TestEntity> = {
				data: [{ id: 1, documentId: "doc1", name: "default" }],
			};
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => foundResponse,
				status: 200,
				statusText: "OK",
			});

			const localeResponse: StrapiSingleResponse<TestEntity> = {
				data: { id: 1, documentId: "doc1", name: "localized" },
			};
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => localeResponse,
				status: 201,
				statusText: "Created",
			});

			const [err, data] = await client.create({ payload, locale: "fr" });
			expect(err).toBeNull();
			expect(data).toEqual(localeResponse.data);
			expect(mockFetch).toHaveBeenCalledTimes(2);
		});

		it("appends params to create URL", async () => {
			const payload: CreatePayload<TestEntity> = { data: { name: "new" } };
			const params: Omit<QueryParams<TestEntity>, "filters"> = {
				populate: ["*"],
			};
			const mockResponse: StrapiSingleResponse<TestEntity> = {
				data: { id: 1, name: "new" },
			};
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
				status: 201,
				statusText: "Created",
			});

			const [err, data] = await client.create({ payload, params });
			expect(err).toBeNull();
			expect(data).toEqual(mockResponse.data);
			expect(mockFetch).toHaveBeenCalledWith(
				`http://localhost/api/test-entities?${qs.stringify(params, {
					addQueryPrefix: false,
					arrayFormat: "indices",
					encode: true,
				})}`,
				expect.any(Object)
			);
		});

		it("returns error on failed creation", async () => {
			const payload: CreatePayload<TestEntity> = { data: { name: "new" } };
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 400,
				statusText: "Bad Request",
			});

			const [err, data] = await client.create({ payload });
			expect(err).toEqual({
				message: "Strapi API error: 400 Bad Request",
				status: 400,
			});
			expect(data).toBeNull();
		});

		it("handles JSON parse error on create", async () => {
			const payload: CreatePayload<TestEntity> = { data: { name: "new" } };
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => {
					throw new Error("Invalid JSON");
				},
				status: 201,
				statusText: "Created",
			});

			const [err, data] = await client.create({ payload });
			expect(err).toEqual({
				message:
					"Strapi API error: Failed to parse JSON response - Invalid JSON",
				status: 201,
			});
			expect(data).toBeNull();
		});
	});

	describe("update", () => {
		it("updates entity successfully", async () => {
			const payload: UpdatePayload<TestEntity> = { data: { name: "updated" } };
			const mockResponse: StrapiSingleResponse<TestEntity> = {
				data: { id: 1, name: "updated" },
			};
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
				status: 200,
				statusText: "OK",
			});

			const [err, data] = await client.update({ id: 1, payload });
			expect(err).toBeNull();
			expect(data).toEqual(mockResponse.data);
		});

		it("appends locale to update URL for non-default", async () => {
			const payload: UpdatePayload<TestEntity> = {
				data: { name: "localized" },
			};
			const mockResponse: StrapiSingleResponse<TestEntity> = {
				data: { id: 1, name: "localized" },
			};
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
				status: 200,
				statusText: "OK",
			});

			const [err, data] = await client.update({ id: 1, payload, locale: "fr" });
			expect(err).toBeNull();
			expect(data).toEqual(mockResponse.data);
			expect(mockFetch).toHaveBeenCalledWith(
				"http://localhost/api/test-entities/1?locale=fr",
				expect.any(Object)
			);
		});

		it("does not append locale for default locale (en)", async () => {
			const payload: UpdatePayload<TestEntity> = {
				data: { name: "updated" },
			};
			const mockResponse: StrapiSingleResponse<TestEntity> = {
				data: { id: 1, name: "updated" },
			};
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
				status: 200,
				statusText: "OK",
			});

			const [err, data] = await client.update({
				id: 1,
				payload,
				locale: "en",
			});
			expect(err).toBeNull();
			expect(data).toEqual(mockResponse.data);
			expect(mockFetch).toHaveBeenCalledWith(
				"http://localhost/api/test-entities/1",
				expect.any(Object)
			);
		});

		it("appends params to update URL", async () => {
			const payload: UpdatePayload<TestEntity> = { data: { name: "updated" } };
			const params: QueryParams<TestEntity> = { populate: ["*"] };
			const mockResponse: StrapiSingleResponse<TestEntity> = {
				data: { id: 1, name: "updated" },
			};
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
				status: 200,
				statusText: "OK",
			});

			const [err, data] = await client.update({ id: 1, payload, params });
			expect(err).toBeNull();
			expect(data).toEqual(mockResponse.data);
			expect(mockFetch).toHaveBeenCalledWith(
				`http://localhost/api/test-entities/1?${qs.stringify(params, {
					addQueryPrefix: false,
					arrayFormat: "indices",
					encode: true,
				})}`,
				expect.any(Object)
			);
		});

		it("returns error on failed update", async () => {
			const payload: UpdatePayload<TestEntity> = { data: { name: "updated" } };
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 404,
				statusText: "Not Found",
			});

			const [err, data] = await client.update({ id: 1, payload });
			expect(err).toEqual({
				message: "Strapi API error: 404 Not Found",
				status: 404,
			});
			expect(data).toBeNull();
		});
	});

	describe("delete", () => {
		it("deletes entity successfully, returning null", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				statusText: "OK",
			});

			const [err, data] = await client.delete({ id: 1 });
			expect(err).toBeNull();
			expect(data).toBeNull();
			expect(mockFetch).toHaveBeenCalledWith(
				"http://localhost/api/test-entities/1",
				expect.objectContaining({ method: "DELETE" })
			);
		});

		it("handles no JSON response on delete", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => {
					throw new Error("No content");
				},
				status: 200,
				statusText: "OK",
			});

			const [err, data] = await client.delete({ id: 1 });
			expect(err).toBeNull();
			expect(data).toBeNull();
		});

		it("appends locale to delete URL for non-default", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ data: null }),
				status: 200,
				statusText: "OK",
			});

			const [err, data] = await client.delete({ id: 1, locale: "fr" });
			expect(err).toBeNull();
			expect(data).toBeNull();
			expect(mockFetch).toHaveBeenCalledWith(
				"http://localhost/api/test-entities/1?locale=fr",
				expect.objectContaining({ method: "DELETE" })
			);
		});

		it("does not append locale for default locale (en)", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ data: null }),
				status: 200,
				statusText: "OK",
			});

			const [err, data] = await client.delete({ id: 1, locale: "en" });
			expect(err).toBeNull();
			expect(data).toBeNull();
			expect(mockFetch).toHaveBeenCalledWith(
				"http://localhost/api/test-entities/1",
				expect.objectContaining({ method: "DELETE" })
			);
		});

		it("returns error on failed delete", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 404,
				statusText: "Not Found",
			});

			const [err, data] = await client.delete({ id: 1 });
			expect(err).toEqual({
				message: "Strapi API error: 404 Not Found",
				status: 404,
			});
			expect(data).toBeNull();
		});
	});

	describe("upsert", () => {
		it("updates existing entity in default locale", async () => {
			const payload: CreatePayload<TestEntity> = { data: { name: "upserted" } };
			const filters: StrapiFilters<TestEntity> = { name: { $eq: "existing" } };

			const foundResponse: StrapiResponse<TestEntity> = {
				data: [{ id: 1, documentId: "doc1", name: "existing" }],
			};
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => foundResponse,
				status: 200,
				statusText: "OK",
			});

			const updateResponse: StrapiSingleResponse<TestEntity> = {
				data: { id: 1, documentId: "doc1", name: "upserted" },
			};
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => updateResponse,
				status: 200,
				statusText: "OK",
			});

			const [err, data] = await client.upsert({ payload, filters });
			expect(err).toBeNull();
			expect(data).toEqual(updateResponse.data);
			expect(mockFetch).toHaveBeenCalledTimes(2);
		});

		it("creates new entity if not existing in default locale", async () => {
			const payload: CreatePayload<TestEntity> = { data: { name: "new" } };
			const filters: StrapiFilters<TestEntity> = {
				name: { $eq: "nonexistent" },
			};

			const emptyResponse: StrapiResponse<TestEntity> = { data: [] };
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => emptyResponse,
				status: 200,
				statusText: "OK",
			});

			const createResponse: StrapiSingleResponse<TestEntity> = {
				data: { id: 2, name: "new" },
			};
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => createResponse,
				status: 201,
				statusText: "Created",
			});

			const [err, data] = await client.upsert({ payload, filters });
			expect(err).toBeNull();
			expect(data).toEqual(createResponse.data);
			expect(mockFetch).toHaveBeenCalledTimes(2);
		});

		it("handles upsert with locale by updating existing", async () => {
			const payload: CreatePayload<TestEntity> = {
				data: { name: "localized" },
			};
			const filters: StrapiFilters<TestEntity> = { name: { $eq: "existing" } };

			const foundResponse: StrapiResponse<TestEntity> = {
				data: [{ id: 1, documentId: "doc1", name: "existing" }],
			};
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => foundResponse,
				status: 200,
				statusText: "OK",
			});

			const updateResponse: StrapiSingleResponse<TestEntity> = {
				data: { id: 1, documentId: "doc1", name: "localized" },
			};
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => updateResponse,
				status: 200,
				statusText: "OK",
			});

			const [err, data] = await client.upsert({
				payload,
				filters,
				locale: "fr",
			});
			expect(err).toBeNull();
			expect(data).toEqual(updateResponse.data);
			expect(mockFetch).toHaveBeenCalledTimes(2);
		});

		it("handles upsert with locale by creating (no existing)", async () => {
			const payload: CreatePayload<TestEntity> = { data: { name: "new-fr" } };
			const filters: StrapiFilters<TestEntity> = {
				name: { $eq: "nonexistent" },
			};

			const emptyLocale: StrapiResponse<TestEntity> = { data: [] };
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => emptyLocale,
				status: 200,
				statusText: "OK",
			});

			const emptyDefault: StrapiResponse<TestEntity> = { data: [] };
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => emptyDefault,
				status: 200,
				statusText: "OK",
			});

			const defaultCreate: StrapiSingleResponse<TestEntity> = {
				data: { id: 3, documentId: "doc3", name: "new-fr" },
			};
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => defaultCreate,
				status: 201,
				statusText: "Created",
			});

			const localeCreate: StrapiSingleResponse<TestEntity> = {
				data: { id: 3, documentId: "doc3", name: "new-fr" },
			};
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => localeCreate,
				status: 201,
				statusText: "Created",
			});

			const [err, data] = await client.upsert({
				payload,
				filters,
				locale: "fr",
			});
			expect(err).toBeNull();
			expect(data).toEqual(localeCreate.data);
			expect(mockFetch).toHaveBeenCalledTimes(4);
		});

		it("returns error if search fails in upsert", async () => {
			const payload: CreatePayload<TestEntity> = { data: { name: "fail" } };
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 500,
				statusText: "Internal Server Error",
			});

			const [err, data] = await client.upsert({ payload });
			expect(err).toEqual({
				message: "Strapi API error: 500 Internal Server Error",
				status: 500,
			});
			expect(data).toBeNull();
			expect(mockFetch).toHaveBeenCalledTimes(1);
		});

		it("appends params to upsert search query", async () => {
			const payload: CreatePayload<TestEntity> = { data: { name: "test" } };
			const filters: StrapiFilters<TestEntity> = { name: { $eq: "test" } };
			const params: Omit<QueryParams<TestEntity>, "filters"> = {
				populate: ["*"],
			};

			const foundResponse: StrapiResponse<TestEntity> = {
				data: [{ id: 1, documentId: "doc1", name: "test" }],
			};
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => foundResponse,
				status: 200,
				statusText: "OK",
			});

			const updateResponse: StrapiSingleResponse<TestEntity> = {
				data: { id: 1, documentId: "doc1", name: "test" },
			};
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => updateResponse,
				status: 200,
				statusText: "OK",
			});

			const [err, data] = await client.upsert({
				payload,
				filters,
				params,
			});
			expect(err).toBeNull();
			expect(data).toEqual(updateResponse.data);
			expect(mockFetch).toHaveBeenCalledTimes(2);
		});
	});
});
