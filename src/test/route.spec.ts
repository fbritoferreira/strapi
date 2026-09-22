import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import { Strapi } from "../index";
import { buildRoutePath } from "../route";
import { installFetchMock, jsonResponse, lastCall, type FetchMock } from "./helpers";

interface UploadFile {
	id: number;
	url: string;
}

declare module "../index" {
	interface StrapiRoutes {
		"GET /upload/files": { query?: { sort?: string[] }; response: UploadFile[] };
		"GET /upload/files/{id}": { params: { id: number }; response: UploadFile };
		"POST /auth/local": { body: { identifier: string; password: string }; response: { jwt: string } };
	}
}

describe("Strapi.route", () => {
	let fetchMock: FetchMock;
	const strapi = new Strapi({ baseURL: "http://h", defaultLocale: "en", token: "tok" });

	beforeEach(() => {
		fetchMock = installFetchMock();
	});
	afterEach(() => vi.restoreAllMocks());

	it("calls the route and types the response", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse([{ id: 1, url: "/a.png" }]));
		const [err, files] = await strapi.route("GET /upload/files");
		expect(err).toBeNull();
		expect(files).toEqual([{ id: 1, url: "/a.png" }]);
		expect(lastCall(fetchMock).url).toBe("http://h/api/upload/files");
		expectTypeOf(files).toEqualTypeOf<UploadFile[] | null>();
	});

	it("substitutes path params", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({ id: 7, url: "/b.png" }));
		await strapi.route("GET /upload/files/{id}", { params: { id: 7 } });
		expect(lastCall(fetchMock).url).toBe("http://h/api/upload/files/7");
	});

	it("encodes a path param that needs it", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({ id: 1, url: "" }));
		// @ts-expect-error the registry types id as a number; this checks the runtime encoding
		await strapi.route("GET /upload/files/{id}", { params: { id: "a/b" } });
		expect(lastCall(fetchMock).url).toBe("http://h/api/upload/files/a%2Fb");
	});

	it("serializes the query", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse([]));
		await strapi.route("GET /upload/files", { query: { sort: ["name:asc"] } });
		expect(decodeURIComponent(lastCall(fetchMock).url)).toBe("http://h/api/upload/files?sort[0]=name:asc");
	});

	it("sends the body and the method", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({ jwt: "j" }));
		const [, session] = await strapi.route("POST /auth/local", { body: { identifier: "me", password: "p" } });
		expect(lastCall(fetchMock).init.method).toBe("POST");
		expect(JSON.parse(String(lastCall(fetchMock).init.body))).toEqual({ identifier: "me", password: "p" });
		expectTypeOf(session).toEqualTypeOf<{ jwt: string } | null>();
	});

	it("returns the error tuple for a failed request", async () => {
		fetchMock.mockResolvedValueOnce(new Response("nope", { status: 500 }));
		const [err, data] = await strapi.route("GET /upload/files");
		expect(err?.status).toBe(500);
		expect(data).toBeNull();
	});

	it("rejects unknown routes and missing params", () => {
		// Never called: these assertions are about what the compiler accepts.
		const rejected = () => {
			// @ts-expect-error the registry declares no such route
			strapi.route("GET /nope");
			// @ts-expect-error this route needs params.id
			strapi.route("GET /upload/files/{id}");
			// @ts-expect-error this route needs a body
			strapi.route("POST /auth/local");
		};
		expect(rejected).toBeTypeOf("function");
	});

	it("refuses to build a path with a param it was not given", () => {
		expect(() => buildRoutePath("GET /upload/files/{id}", {})).toThrow(/needs the path param "id"/);
		expect(() => buildRoutePath("GET /upload/files/{id}", undefined)).toThrow(TypeError);
	});
});
