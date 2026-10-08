import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HttpClient } from "../http";
import { errorResponse, headerOf, installFetchMock, jsonResponse, type FetchMock } from "./helpers";

const unauthorized = () => errorResponse(401, "UnauthorizedError", "Missing or invalid credentials");
const refreshed = () => jsonResponse({ jwt: "next", refreshToken: "rotated" });

describe("HttpClient refreshOnUnauthorized", () => {
	let fetchMock: FetchMock;

	beforeEach(() => {
		fetchMock = installFetchMock();
	});

	afterEach(() => vi.restoreAllMocks());

	it("rotates the token and retries the request once", async () => {
		const seen: string[] = [];
		fetchMock.mockImplementation(async (_input, init) => {
			seen.push(headerOf(init ?? {}, "authorization") ?? "");
			if (seen.length === 1) return unauthorized();
			if (String(_input).endsWith("/auth/refresh")) return refreshed();
			return jsonResponse({ data: [{ id: 1 }] });
		});
		const onRefresh = vi.fn();
		const client = new HttpClient({
			baseURL: "http://h",
			token: "expired",
			refreshOnUnauthorized: { token: "refresh-1", onRefresh },
		});

		const [err, body] = await client.request<{ data: { id: number }[] }>("articles", {
			signal: new AbortController().signal,
		});
		expect(err).toBeNull();
		expect(body?.data).toEqual([{ id: 1 }]);
		expect(onRefresh).toHaveBeenCalledWith({ jwt: "next", refreshToken: "rotated" });
		expect(seen[0]).toBe("Bearer expired");
		expect(seen.at(-1)).toBe("Bearer next");
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it("reads the refresh token from a getter and shares one rotation across concurrent 401s", async () => {
		let refreshes = 0;
		fetchMock.mockImplementation(async (input, init) => {
			if (String(input).endsWith("/auth/refresh")) {
				refreshes += 1;
				await new Promise((resolve) => setTimeout(resolve, 5));
				return refreshed();
			}
			if (headerOf(init ?? {}, "authorization") === "Bearer next") return jsonResponse({ ok: true });
			return unauthorized();
		});
		const client = new HttpClient({
			baseURL: "http://h",
			token: "expired",
			refreshOnUnauthorized: { token: () => "from-getter" },
		});

		const [first, second] = await Promise.all([client.request("articles"), client.request("pages")]);
		expect(first[0]).toBeNull();
		expect(second[0]).toBeNull();
		expect(refreshes).toBe(1);
		const refreshCall = fetchMock.mock.calls.find((call) => String(call[0]).endsWith("/auth/refresh"));
		expect(JSON.parse(String(refreshCall?.[1]?.body))).toEqual({ refreshToken: "from-getter" });
	});

	it("does nothing when refresh is not configured, the signal is aborted, or no token is available", async () => {
		fetchMock.mockImplementation(() => Promise.resolve(unauthorized()));
		const plain = new HttpClient({ baseURL: "http://h", token: "t" });
		expect((await plain.request("articles"))[0]?.status).toBe(401);
		expect(fetchMock).toHaveBeenCalledTimes(1);

		const controller = new AbortController();
		controller.abort();
		const armed = new HttpClient({ baseURL: "http://h", token: "t", refreshOnUnauthorized: { token: "r" } });
		expect((await armed.request("articles", { signal: controller.signal }))[0]?.status).toBe(401);
		expect(fetchMock).toHaveBeenCalledTimes(2);

		const cookieless = new HttpClient({ baseURL: "http://h", token: "t", refreshOnUnauthorized: { token: () => undefined } });
		expect((await cookieless.request("articles"))[0]?.message).toBe("Strapi: no refresh token to rotate");
		const blank = new HttpClient({ baseURL: "http://h", token: "t", refreshOnUnauthorized: { token: "" } });
		expect((await blank.request("articles"))[0]?.message).toBe("Strapi: no refresh token to rotate");
	});

	it("sends credentials and an empty body in cookie mode, even with no bearer token", async () => {
		let articles = 0;
		fetchMock.mockImplementation(async (input) => {
			if (String(input).endsWith("/auth/refresh")) return refreshed();
			articles += 1;
			return articles === 1 ? unauthorized() : jsonResponse({ ok: true });
		});
		const client = new HttpClient({ baseURL: "http://h", refreshOnUnauthorized: { cookie: true } });
		const [err] = await client.request("articles");
		expect(err).toBeNull();
		const refreshCall = fetchMock.mock.calls.find((call) => String(call[0]).endsWith("/auth/refresh"));
		expect(refreshCall?.[1]?.credentials).toBe("include");
		expect(JSON.parse(String(refreshCall?.[1]?.body))).toEqual({});
		expect(headerOf(refreshCall?.[1] ?? {}, "authorization")).toBeNull();
	});

	it("returns the refresh failure and does not retry the original request", async () => {
		fetchMock.mockImplementation(async (input) => {
			if (String(input).endsWith("/auth/refresh")) return errorResponse(404, "NotFoundError", "Not Found");
			return unauthorized();
		});
		const client = new HttpClient({ baseURL: "http://h", token: "t", refreshOnUnauthorized: { token: "r" } });
		const [err] = await client.request("articles");
		expect(err?.status).toBe(404);
		expect(err?.message).toContain("jwtManagement");
		expect(fetchMock.mock.calls.filter((call) => String(call[0]).endsWith("/articles"))).toHaveLength(1);
	});

	it("reports a non-404 refresh failure, invalid JSON, an empty body, and a throwing onRefresh", async () => {
		const client = () => new HttpClient({ baseURL: "http://h", token: "t", refreshOnUnauthorized: { token: "r", onRefresh: () => { throw new Error("store failed"); } } });

		fetchMock.mockImplementation(async (input) => {
			if (String(input).endsWith("/auth/refresh")) return errorResponse(400, "ValidationError", "bad token");
			return unauthorized();
		});
		expect((await client().request("articles"))[0]?.status).toBe(400);

		fetchMock.mockImplementation(async (input) => {
			if (String(input).endsWith("/auth/refresh")) return new Response("nope", { status: 200 });
			return unauthorized();
		});
		expect((await client().request("articles"))[0]?.message).toBe("Strapi: refresh answered with invalid JSON");

		fetchMock.mockImplementation(async (input) => {
			if (String(input).endsWith("/auth/refresh")) return new Response("", { status: 200 });
			return unauthorized();
		});
		expect((await client().request("articles"))[0]?.message).toBe("Strapi: refresh answered with an empty body");

		fetchMock.mockImplementation(async (input) => {
			if (String(input).endsWith("/auth/refresh")) return jsonResponse({});
			return unauthorized();
		});
		expect((await client().request("articles"))[0]?.message).toBe("Strapi: refresh answered with an empty body");

		const throwing = new HttpClient({
			baseURL: "http://h",
			token: "t",
			refreshOnUnauthorized: {
				token: "r",
				onRefresh: () => {
					throw "nope";
				},
			},
		});
		fetchMock.mockImplementation(async (input) => {
			if (String(input).endsWith("/auth/refresh")) return refreshed();
			return unauthorized();
		});
		expect((await throwing.request("articles"))[0]?.message).toBe("nope");
		expect((await client().request("articles"))[0]?.message).toBe("store failed");
	});

	it("does not refresh the refresh route itself, and surfaces a network failure", async () => {
		fetchMock.mockImplementation(() => Promise.resolve(unauthorized()));
		const client = new HttpClient({ baseURL: "http://h", token: "t", refreshOnUnauthorized: { token: "r" } });
		expect((await client.request("auth/refresh"))[0]?.status).toBe(401);
		expect((await client.request("http://h/api/auth/refresh"))[0]?.status).toBe(401);
		expect(fetchMock).toHaveBeenCalledTimes(2);

		fetchMock.mockImplementation(async (input) => {
			if (String(input).endsWith("/auth/refresh")) throw new TypeError("fetch failed");
			return unauthorized();
		});
		expect((await client.request("articles"))[0]?.name).toBe("NetworkError");
	});
});
