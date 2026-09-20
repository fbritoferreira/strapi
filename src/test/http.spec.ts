import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HttpClient } from "../http";
import {
	emptyResponse,
	errorResponse,
	headerOf,
	installFetchMock,
	jsonResponse,
	lastCall,
	textResponse,
	type FetchMock,
} from "./helpers";

describe("HttpClient", () => {
	let fetchMock: FetchMock;

	beforeEach(() => {
		fetchMock = installFetchMock();
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	describe("baseURL", () => {
		it.each([
			["http://localhost:1337", "http://localhost:1337/api"],
			["http://localhost:1337/", "http://localhost:1337/api"],
			["http://localhost:1337///", "http://localhost:1337/api"],
			["http://localhost:1337/api", "http://localhost:1337/api"],
			["http://localhost:1337/api/", "http://localhost:1337/api"],
		])("normalizes %s to %s", (input, expected) => {
			expect(new HttpClient({ baseURL: input }).baseURL).toBe(expected);
		});

		it("rejects an empty baseURL", () => {
			expect(() => new HttpClient({ baseURL: "" })).toThrow(TypeError);
		});
	});

	describe("request", () => {
		it("joins path, strips leading slashes, keeps query string", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse({ data: [] }));
			const http = new HttpClient({ baseURL: "http://h" });
			await http.request("//articles?populate=*");
			expect(lastCall(fetchMock).url).toBe("http://h/api/articles?populate=*");
		});

		it("sends Authorization and custom headers", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse({ data: [] }));
			const http = new HttpClient({ baseURL: "http://h", token: "t", headers: { "X-Trace": "1" } });
			await http.request("articles");
			const { init } = lastCall(fetchMock);
			expect(headerOf(init, "authorization")).toBe("Bearer t");
			expect(headerOf(init, "x-trace")).toBe("1");
		});

		it("omits Authorization without a token", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse({ data: [] }));
			await new HttpClient({ baseURL: "http://h" }).request("articles");
			expect(headerOf(lastCall(fetchMock).init, "authorization")).toBeNull();
		});

		it("sets JSON content type for string bodies only", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse({ data: {} }));
			const http = new HttpClient({ baseURL: "http://h" });
			await http.request("articles", { method: "POST", body: JSON.stringify({ data: {} }) });
			expect(headerOf(lastCall(fetchMock).init, "content-type")).toBe("application/json");
			fetchMock.mockResolvedValueOnce(jsonResponse({ data: {} }));
			await http.request("upload", { method: "POST", body: new FormData() });
			expect(headerOf(lastCall(fetchMock).init, "content-type")).toBeNull();
		});

		it("lets per-call init override headers and pass through extra keys", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse({ data: [] }));
			const http = new HttpClient({ baseURL: "http://h", token: "t" });
			await http.request("articles", {
				headers: { Authorization: "Bearer other" },
				cache: "no-store",
				next: { revalidate: 60, tags: ["articles"] },
			});
			const { init } = lastCall(fetchMock);
			expect(headerOf(init, "authorization")).toBe("Bearer other");
			expect(init.cache).toBe("no-store");
			expect((init as { next?: unknown }).next).toEqual({ revalidate: 60, tags: ["articles"] });
		});

		it("uses the injected fetch", async () => {
			const custom = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ data: 1 }));
			const http = new HttpClient({ baseURL: "http://h", fetch: custom });
			const [err, data] = await http.request<{ data: number }>("x");
			expect(err).toBeNull();
			expect(data).toEqual({ data: 1 });
			expect(custom).toHaveBeenCalledTimes(1);
			expect(fetchMock).not.toHaveBeenCalled();
		});

		it("returns parsed JSON on 2xx", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse({ data: { a: 1 } }, 201));
			const [err, data] = await new HttpClient({ baseURL: "http://h" }).request("x");
			expect(err).toBeNull();
			expect(data).toEqual({ data: { a: 1 } });
		});

		it("returns null data on 204 and on empty 200", async () => {
			const http = new HttpClient({ baseURL: "http://h" });
			fetchMock.mockResolvedValueOnce(emptyResponse(204));
			expect(await http.request("x")).toEqual([null, null]);
			fetchMock.mockResolvedValueOnce(new Response("", { status: 200 }));
			expect(await http.request("x")).toEqual([null, null]);
		});

		it("maps a Strapi error body", async () => {
			fetchMock.mockResolvedValueOnce(
				errorResponse(400, "ValidationError", "title must be defined", { errors: [{ path: ["title"] }] })
			);
			const [err, data] = await new HttpClient({ baseURL: "http://h" }).request("x");
			expect(data).toBeNull();
			expect(err).toEqual({
				status: 400,
				name: "ValidationError",
				message: "title must be defined",
				details: { errors: [{ path: ["title"] }] },
			});
		});

		it("maps a non-JSON error response", async () => {
			fetchMock.mockResolvedValueOnce(textResponse("Bad Gateway", 502));
			const [err] = await new HttpClient({ baseURL: "http://h" }).request("x");
			expect(err).toEqual({ status: 502, name: "HTTPError", message: "Strapi API error: 502" });
		});

		it("reports invalid JSON on 2xx as HTTPError", async () => {
			fetchMock.mockResolvedValueOnce(new Response("{not json", { status: 200 }));
			const [err] = await new HttpClient({ baseURL: "http://h" }).request("x");
			expect(err?.name).toBe("HTTPError");
			expect(err?.status).toBe(200);
			expect(err?.message).toMatch(/Failed to parse JSON/);
		});

		it("maps a thrown fetch error to NetworkError with cause", async () => {
			const boom = new Error("ECONNREFUSED");
			fetchMock.mockRejectedValueOnce(boom);
			const [err] = await new HttpClient({ baseURL: "http://h" }).request("x");
			expect(err).toEqual({ name: "NetworkError", message: "ECONNREFUSED", cause: boom });
		});

		it("aborts after timeout with TimeoutError", async () => {
			vi.useFakeTimers();
			fetchMock.mockImplementationOnce(
				(_input, init) =>
					new Promise((_resolve, reject) => {
						init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
					})
			);
			const http = new HttpClient({ baseURL: "http://h", timeout: 50 });
			const pending = http.request("x");
			await vi.advanceTimersByTimeAsync(60);
			const [err] = await pending;
			expect(err?.name).toBe("TimeoutError");
			expect(err?.message).toMatch(/50 ?ms/);
		});

		it("combines a caller signal with the timeout", async () => {
			fetchMock.mockImplementationOnce(
				(_input, init) =>
					new Promise((_resolve, reject) => {
						init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
					})
			);
			const controller = new AbortController();
			const http = new HttpClient({ baseURL: "http://h" });
			const pending = http.request("x", { signal: controller.signal });
			controller.abort(new Error("user cancelled"));
			const [err] = await pending;
			expect(err?.name).toBe("NetworkError");
			expect(err?.message).toBe("user cancelled");
		});
	});
});
