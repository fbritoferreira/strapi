import qs from "qs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StrapiClient } from "../client";

interface QueryParams<T> {
	filters?: StrapiFilters<T>;
	populate?: string[];
	pagination?: { pageSize: number };
}
type StrapiFilters<T> = Partial<Record<keyof T, unknown>>;
interface CreatePayload<T> {
	data: T;
}
interface UpdatePayload<T> {
	data: Partial<T>;
}

interface TestEntity {
	id: number;
	name: string;
	documentId?: string;
}

describe("StrapiClient", () => {
	let client: StrapiClient<TestEntity>;
	let mockFetch: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		client = new StrapiClient<TestEntity>({
			baseURL: "http://localhost",
			token: "mock-token",
			uid: "test-entities",
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
				token: undefined,
				uid: "uid",
			});
			expect((c as StrapiClient<TestEntity>)["baseURL"]).toBe(
				"http://localhost/api"
			);
		});

		it("normalizes baseURL correctly with trailing slash", () => {
			const c = new StrapiClient<TestEntity>({
				baseURL: "http://localhost/",
				token: undefined,
				uid: "uid",
			});
			expect((c as StrapiClient<TestEntity>)["baseURL"]).toBe(
				"http://localhost/api"
			);
		});

		it("normalizes baseURL correctly if already ends with /api", () => {
			const c = new StrapiClient<TestEntity>({
				baseURL: "http://localhost/api",
				token: undefined,
				uid: "uid",
			});
			expect((c as StrapiClient<TestEntity>)["baseURL"]).toBe(
				"http://localhost/api"
			);
		});

		it("normalizes baseURL with multiple trailing slashes", () => {
			const c = new StrapiClient<TestEntity>({
				baseURL: "http://localhost///",
				token: undefined,
				uid: "uid",
			});
			expect((c as StrapiClient<TestEntity>)["baseURL"]).toBe(
				"http://localhost/api"
			);
		});

		it("includes Authorization header if token provided", () => {
			const c = new StrapiClient<TestEntity>({
				baseURL: "http://localhost",
				token: "token",
				uid: "uid",
			});
			expect((c as StrapiClient<TestEntity>)["headers"]).toHaveProperty(
				"Authorization",
				"Bearer token"
			);
		});

		it("excludes Authorization header if no token", () => {
			const c = new StrapiClient<TestEntity>({
				baseURL: "http://localhost",
				token: undefined,
				uid: "uid",
			});
			expect((c as StrapiClient<TestEntity>)["headers"]).not.toHaveProperty(
				"Authorization"
			);
		});

		it("sets Content-Type header", () => {
			const c = new StrapiClient<TestEntity>({
				baseURL: "http://localhost",
				token: undefined,
				uid: "uid",
			});
			expect((c as StrapiClient<TestEntity>)["headers"]).toHaveProperty(
				"Content-Type",
				"application/json"
			);
		});
	});

	describe("findMany", () => {
		it("fetches multiple entities successfully without params", async () => {
			const mockResponse = {
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

		it("fetches with query params", async () => {
			const params: QueryParams<TestEntity> = { populate: ["*"] };
			const mockResponse = { data: [] };
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
					arrayFormat: "indices",
					encode: true,
				})}`,
				expect.any(Object)
			);
		});

		it("fetches with locale parameter when locale !== 'en'", async () => {
			const mockResponse = { data: [{ id: 1, name: "test" }] };
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
				status: 200,
				statusText: "OK",
			});

			const [err, data] = await client.findMany(undefined, "fr");
			expect(err).toBeNull();
			expect(data).toEqual(mockResponse.data);
			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining("locale=fr"),
				expect.any(Object)
			);
		});

		it("does not include locale when locale === 'en'", async () => {
			const mockResponse = { data: [] };
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
				status: 200,
				statusText: "OK",
			});

			await client.findMany(undefined, "en");
			const callUrl = mockFetch.mock.calls[0][0] as string;
			expect(callUrl).not.toContain("locale=en");
		});

		it("returns empty array when response data is null", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ data: null }),
				status: 200,
				statusText: "OK",
			});

			const [err, data] = await client.findMany();
			expect(err).toBeNull();
			expect(data).toEqual([]);
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
	});

	describe("find", () => {
		it("fetches single entity by id successfully", async () => {
			const mockResponse = { data: { id: 1, name: "test" } };
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

		it("returns null when response data is null with id", async () => {
			const mockResponse = { data: null };
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
				status: 200,
				statusText: "OK",
			});

			const [err, data] = await client.find({ id: 1 });
			expect(err).toBeNull();
			expect(data).toBeNull();
		});

		it("returns error on failed fetch with id", async () => {
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

		it("returns first entity without id", async () => {
			const mockResponse = { data: [{ id: 1, name: "first" }] };
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
				status: 200,
				statusText: "OK",
			});

			const [err, data] = await client.find({ params: {} });
			expect(err).toBeNull();
			expect(data).toEqual(mockResponse.data[0]);
		});

		it("returns null when no data without id", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ data: [] }),
				status: 200,
				statusText: "OK",
			});

			const [err, data] = await client.find({ params: {} });
			expect(err).toBeNull();
			expect(data).toBeNull();
		});

		it("returns error from findMany when no id", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 500,
				statusText: "Internal Server Error",
			});

			const [err, data] = await client.find({ params: {} });
			expect(err).toBeDefined();
			expect(err!.status).toBe(500);
			expect(data).toBeNull();
		});

		it("includes locale in query when provided without id", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ data: [{ id: 1, name: "test" }] }),
				status: 200,
				statusText: "OK",
			});

			await client.find({ locale: "fr" });
			const callUrl = mockFetch.mock.calls[0][0] as string;
			expect(callUrl).toContain("locale=fr");
		});
	});

	describe("create", () => {
		it("creates entity successfully with default locale", async () => {
			const payload: CreatePayload<TestEntity> = { data: { name: "new" } };
			const mockResponse = { data: { id: 1, name: "new" } };
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

		it("returns null when default locale create response data is null", async () => {
			const payload: CreatePayload<TestEntity> = { data: { name: "new" } };
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ data: null }),
				status: 201,
				statusText: "Created",
			});

			const [err, data] = await client.create({ payload });
			expect(err).toBeNull();
			expect(data).toBeNull();
		});

		it("returns error on failed default locale creation", async () => {
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

		it("handles JSON parse error on default locale create", async () => {
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

		// Non-default locale tests
		it("creates localized entry when default locale base entry found with documentId", async () => {
			const payload: CreatePayload<TestEntity> = {
				data: { name: "localized" },
			};
			const filters = { name: "test" };
			const searchResponse = {
				data: [{ id: 1, documentId: "doc-1", name: "base" }],
			};
			const localizedResponse = {
				data: { id: 2, documentId: "doc-1", name: "localized" },
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => searchResponse,
				status: 200,
				statusText: "OK",
			});

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => localizedResponse,
				status: 200,
				statusText: "OK",
			});

			const [err, data] = await client.create({
				payload,
				filters,
				locale: "fr",
			});
			expect(err).toBeNull();
			expect(data).toEqual(localizedResponse.data);
			expect(mockFetch).toHaveBeenCalledTimes(2);
		});

		it("creates default and localized entries when base entry not found", async () => {
			const payload: CreatePayload<TestEntity> = {
				data: { name: "localized" },
			};
			const filters = { name: "test" };
			const searchResponse = { data: [] };
			const createResponse = {
				data: { id: 1, documentId: "doc-1", name: "base" },
			};
			const localizedResponse = {
				data: { id: 2, documentId: "doc-1", name: "localized" },
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => searchResponse,
				status: 200,
				statusText: "OK",
			});

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => createResponse,
				status: 201,
				statusText: "Created",
			});

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => localizedResponse,
				status: 200,
				statusText: "OK",
			});

			const [err, data] = await client.create({
				payload,
				filters,
				locale: "fr",
			});
			expect(err).toBeNull();
			expect(data).toEqual(localizedResponse.data);
			expect(mockFetch).toHaveBeenCalledTimes(3);
		});

		it("returns error if search fails during non-default locale create", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 500,
				statusText: "Internal Server Error",
			});

			const [err, data] = await client.create({
				payload: { data: { name: "fail" } },
				locale: "fr",
			});

			expect(err).toEqual({
				message: "Strapi API error: 500 Internal Server Error",
				status: 500,
			});
			expect(data).toBeNull();
		});

		it("returns error if create fails during non-default locale setup", async () => {
			const payload: CreatePayload<TestEntity> = {
				data: { name: "localized" },
			};
			const searchResponse = { data: [] };

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => searchResponse,
				status: 200,
				statusText: "OK",
			});

			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 400,
				statusText: "Bad Request",
			});

			const [err, data] = await client.create({
				payload,
				locale: "fr",
			});

			expect(err).toBeDefined();
			expect(err!.status).toBe(400);
			expect(data).toBeNull();
		});

		it("returns error when localized PUT request fails", async () => {
			const payload: CreatePayload<TestEntity> = {
				data: { name: "localized" },
			};
			const filters = { name: "test" };
			const searchResponse = {
				data: [{ id: 1, documentId: "doc-1", name: "base" }],
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => searchResponse,
				status: 200,
				statusText: "OK",
			});

			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 400,
				statusText: "Bad Request",
			});

			const [err, data] = await client.create({
				payload,
				filters,
				locale: "fr",
			});

			expect(err).toBeDefined();
			expect(err!.status).toBe(400);
			expect(data).toBeNull();
		});

		it("returns error when localized response missing documentId", async () => {
			const payload: CreatePayload<TestEntity> = {
				data: { name: "localized" },
			};
			const searchResponse = {
				data: [{ id: 1, documentId: "doc-1", name: "base" }],
			};
			const localizedResponse = { data: { id: 2, name: "localized" } }; // no documentId

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => searchResponse,
				status: 200,
				statusText: "OK",
			});

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => localizedResponse,
				status: 200,
				statusText: "OK",
			});

			const [err, data] = await client.create({
				payload,
				locale: "fr",
			});

			expect(err).toBeNull(); // localeErr is null
			expect(data).toBeNull();
		});

		it("uses documentId string from found base entry in non-default locale", async () => {
			const payload: CreatePayload<TestEntity> = {
				data: { name: "localized" },
			};
			const searchResponse = {
				data: [{ id: 999, documentId: "doc-1", name: "base" }],
			};
			const localizedResponse = {
				data: { id: 2, documentId: "doc-1", name: "localized" },
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => searchResponse,
				status: 200,
				statusText: "OK",
			});

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => localizedResponse,
				status: 200,
				statusText: "OK",
			});

			await client.create({ payload, locale: "fr" });

			// Second call should use documentId string in URL
			expect(mockFetch.mock.calls[1][0]).toContain("/doc-1?locale=fr");
		});

		it("uses documentId string from created base entry in non-default locale", async () => {
			const payload: CreatePayload<TestEntity> = {
				data: { name: "localized" },
			};
			const searchResponse = { data: [] };
			const createResponse = {
				data: { id: 1, documentId: "doc-2", name: "base" },
			};
			const localizedResponse = {
				data: { id: 2, documentId: "doc-2", name: "localized" },
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => searchResponse,
				status: 200,
				statusText: "OK",
			});

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => createResponse,
				status: 201,
				statusText: "Created",
			});

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => localizedResponse,
				status: 200,
				statusText: "OK",
			});

			await client.create({ payload, locale: "fr" });

			// Third call should use documentId string from created response
			expect(mockFetch.mock.calls[2][0]).toContain("/doc-2?locale=fr");
		});
	});

	describe("update", () => {
		it("updates entity with default locale (en)", async () => {
			const payload: UpdatePayload<TestEntity> = { data: { name: "updated" } };
			const mockResponse = { data: { id: 1, name: "updated" } };
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

		it("updates entity with non-default locale", async () => {
			const payload: UpdatePayload<TestEntity> = { data: { name: "updated" } };
			const mockResponse = { data: { id: 1, name: "updated" } };
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
				status: 200,
				statusText: "OK",
			});

			const [err, data] = await client.update({
				id: 1,
				payload,
				locale: "fr",
			});
			expect(err).toBeNull();
			expect(data).toEqual(mockResponse.data);
			expect(mockFetch).toHaveBeenCalledWith(
				"http://localhost/api/test-entities/1?locale=fr",
				expect.any(Object)
			);
		});

		it("returns null when update response data is null", async () => {
			const payload: UpdatePayload<TestEntity> = { data: { name: "updated" } };
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ data: null }),
				status: 200,
				statusText: "OK",
			});

			const [err, data] = await client.update({ id: 1, payload });
			expect(err).toBeNull();
			expect(data).toBeNull();
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

		it("updates without locale param - should not add locale query string", async () => {
			const payload: UpdatePayload<TestEntity> = { data: { name: "updated" } };
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ data: { id: 1, name: "updated" } }),
				status: 200,
				statusText: "OK",
			});

			await client.update({ id: 1, payload });

			// Without locale param, URL should not include locale query
			const callUrl = mockFetch.mock.calls[0][0] as string;
			expect(callUrl).toBe("http://localhost/api/test-entities/1");
			expect(callUrl).not.toContain("locale=");
		});
	});

	describe("delete", () => {
		it("deletes entity successfully", async () => {
			const mockResponse = { data: { id: 1, name: "deleted" } };
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
				status: 200,
				statusText: "OK",
			});

			const [err, data] = await client.delete({ id: 1 });
			expect(err).toBeNull();
			expect(data).toEqual(mockResponse.data);
		});

		it("handles no JSON response on delete (DELETE JSON parse fallback)", async () => {
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
			// When DELETE JSON parse fails, the fallback returns { data: null }
			// but response?.data extracts to null
			expect(data).toBeNull();
		});

		it("returns null when delete response data is null", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ data: null }),
				status: 200,
				statusText: "OK",
			});

			const [err, data] = await client.delete({ id: 1 });
			expect(err).toBeNull();
			expect(data).toBeNull();
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

		it("handles network error on delete", async () => {
			mockFetch.mockRejectedValueOnce(new Error("Network error"));

			const [err, data] = await client.delete({ id: 1 });
			expect(err).toEqual({ message: "Strapi API error: Network error" });
			expect(data).toBeNull();
		});

		it("ignores locale parameter on delete", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ data: { id: 1 } }),
				status: 200,
				statusText: "OK",
			});

			await client.delete({ id: 1, locale: "fr" });

			// Delete should ignore locale parameter
			const callUrl = mockFetch.mock.calls[0][0] as string;
			expect(callUrl).toBe("http://localhost/api/test-entities/1");
		});
	});

	describe("upsert", () => {
		it("updates existing entity", async () => {
			const payload: CreatePayload<TestEntity> = { data: { name: "upserted" } };
			const filters: StrapiFilters<TestEntity> = { name: "existing" };

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					data: [{ id: 1, name: "existing", documentId: "doc-1" }],
				}),
				status: 200,
				statusText: "OK",
			});

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ data: { id: 1, name: "upserted" } }),
				status: 200,
				statusText: "OK",
			});

			const [err, data] = await client.upsert({ payload, filters });
			expect(err).toBeNull();
			expect(data).toEqual({ id: 1, name: "upserted" });
			expect(mockFetch).toHaveBeenCalledTimes(2);
		});

		it("uses documentId when available in upsert update", async () => {
			const payload: CreatePayload<TestEntity> = { data: { name: "upserted" } };
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					data: [{ id: 999, documentId: "doc-1", name: "existing" }],
				}),
				status: 200,
				statusText: "OK",
			});

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ data: { id: 999, name: "upserted" } }),
				status: 200,
				statusText: "OK",
			});

			await client.upsert({ payload });

			// Second call (update) should use documentId
			expect(mockFetch.mock.calls[1][0]).toContain("/doc-1");
		});

		it("creates new entity if not existing", async () => {
			const payload: CreatePayload<TestEntity> = { data: { name: "new" } };
			const filters: StrapiFilters<TestEntity> = { name: "nonexistent" };

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ data: [] }),
				status: 200,
				statusText: "OK",
			});

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ data: { id: 2, name: "new" } }),
				status: 201,
				statusText: "Created",
			});

			const [err, data] = await client.upsert({ payload, filters });
			expect(err).toBeNull();
			expect(data).toEqual({ id: 2, name: "new" });
			expect(mockFetch).toHaveBeenCalledTimes(2);
		});

		it("returns error if search fails", async () => {
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

		it("returns error if update fails during upsert", async () => {
			const payload: CreatePayload<TestEntity> = { data: { name: "upserted" } };

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					data: [{ id: 1, name: "existing", documentId: "doc-1" }],
				}),
				status: 200,
				statusText: "OK",
			});

			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 400,
				statusText: "Bad Request",
			});

			const [err, data] = await client.upsert({ payload });
			expect(err).toBeDefined();
			expect(err!.status).toBe(400);
			expect(data).toBeNull();
		});

		it("returns error if create fails during upsert", async () => {
			const payload: CreatePayload<TestEntity> = { data: { name: "new" } };

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ data: [] }),
				status: 200,
				statusText: "OK",
			});

			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 400,
				statusText: "Bad Request",
			});

			const [err, data] = await client.upsert({ payload });
			expect(err).toBeDefined();
			expect(err!.status).toBe(400);
			expect(data).toBeNull();
		});

		it("includes locale in search for non-default locale upsert", async () => {
			const payload: CreatePayload<TestEntity> = { data: { name: "new" } };

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ data: [] }),
				status: 200,
				statusText: "OK",
			});

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ data: { id: 1, name: "new" } }),
				status: 201,
				statusText: "Created",
			});

			await client.upsert({ payload, locale: "fr" });

			// First call (search) should include locale parameter
			const searchUrl = mockFetch.mock.calls[0][0] as string;
			expect(searchUrl).toContain("locale=fr");
		});

		it("passes locale to update in upsert", async () => {
			const payload: CreatePayload<TestEntity> = { data: { name: "upserted" } };

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					data: [{ id: 1, name: "existing", documentId: "doc-1" }],
				}),
				status: 200,
				statusText: "OK",
			});

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ data: { id: 1, name: "upserted" } }),
				status: 200,
				statusText: "OK",
			});

			await client.upsert({ payload, locale: "fr" });

			// Second call (update) should include locale
			const updateUrl = mockFetch.mock.calls[1][0] as string;
			expect(updateUrl).toContain("locale=fr");
		});

		it("passes locale to create in upsert when non-default locale", async () => {
			const payload: CreatePayload<TestEntity> = { data: { name: "new" } };

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ data: [] }),
				status: 200,
				statusText: "OK",
			});

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ data: { id: 2, name: "new" } }),
				status: 201,
				statusText: "Created",
			});

			await client.upsert({ payload, locale: "fr" });

			expect(mockFetch).toHaveBeenCalledTimes(3);
		});
	});

	describe("getQueryString", () => {
		it("returns empty string when no params", async () => {
			const result = (client as unknown).getQueryString();
			expect(result).toBe("");
		});

		it("returns empty string when empty params object", async () => {
			const result = (client as unknown).getQueryString({});
			expect(result).toBe("");
		});

		it("returns query string with params", async () => {
			const result = (client as StrapiClient<T>).getQueryString({
				populate: ["*"],
			});
			expect(result).toContain("?");
			expect(result).toContain("populate");
		});
	});

	describe("request endpoint normalization", () => {
		it("normalizes endpoint with leading slashes", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ data: [] }),
				status: 200,
				statusText: "OK",
			});

			await (client as StrapiClient<TestEntity>)["request"]("///test-entities");

			expect(mockFetch).toHaveBeenCalledWith(
				"http://localhost/api/test-entities",
				expect.any(Object)
			);
		});

		it("merges custom headers with default headers", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ data: [] }),
				status: 200,
				statusText: "OK",
			});

			await (client as StrapiClient<TestEntity>)["request"]("test", {
				headers: { "X-Custom": "value" },
			});

			expect(mockFetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					headers: expect.objectContaining({
						"Content-Type": "application/json",
						"X-Custom": "value",
					}),
				})
			);
		});
	});
});
