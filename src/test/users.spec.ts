import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UsersClient } from "../clients/users";
import { HttpClient } from "../http";
import { errorResponse, installFetchMock, jsonResponse, lastCall, type FetchMock } from "./helpers";

interface User {
	id: number;
	username: string;
	email: string;
}

const user = (id: number): User => ({ id, username: `u${id}`, email: `u${id}@x.io` });

describe("UsersClient", () => {
	let fetchMock: FetchMock;
	let users: UsersClient<User>;

	beforeEach(() => {
		fetchMock = installFetchMock();
		users = new UsersClient<User>({ http: new HttpClient({ baseURL: "http://h", token: "t" }), defaultLocale: "en", concurrency: 1 });
	});

	afterEach(() => vi.restoreAllMocks());

	it("findMany returns the plain array with params", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse([user(1), user(2)]));
		const [err, data, meta] = await users.findMany({ params: { filters: { username: { $eq: "u1" } } } });
		expect(err).toBeNull();
		expect(data).toEqual([user(1), user(2)]);
		expect(meta).toBeNull();
		expect(decodeURIComponent(lastCall(fetchMock).url)).toBe("http://h/api/users?filters[username][$eq]=u1");
	});

	it("findMany returns [] for empty body", async () => {
		fetchMock.mockResolvedValueOnce(new Response("", { status: 200 }));
		const [err, data] = await users.findMany();
		expect(err).toBeNull();
		expect(data).toEqual([]);
	});

	it("find gets by numeric id", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse(user(3)));
		const [err, data] = await users.find({ id: 3, params: { populate: ["role"] } });
		expect(err).toBeNull();
		expect(data).toEqual(user(3));
		expect(decodeURIComponent(lastCall(fetchMock).url)).toBe("http://h/api/users/3?populate[0]=role");
	});

	it("me gets /users/me", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse(user(7)));
		const [err, data] = await users.me();
		expect(err).toBeNull();
		expect(data?.id).toBe(7);
		expect(lastCall(fetchMock).url).toBe("http://h/api/users/me");
	});

	it("count reads the numeric body", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse(42));
		const [err, total] = await users.count();
		expect(err).toBeNull();
		expect(total).toBe(42);
		expect(lastCall(fetchMock).url).toBe("http://h/api/users/count");
	});

	it("create posts fields unwrapped", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse(user(9), 201));
		const [err, data] = await users.create({ data: { username: "u9", email: "u9@x.io" } });
		expect(err).toBeNull();
		expect(data?.id).toBe(9);
		expect(lastCall(fetchMock).init.method).toBe("POST");
		expect(JSON.parse(String(lastCall(fetchMock).init.body))).toEqual({ username: "u9", email: "u9@x.io" });
	});

	it("update puts fields unwrapped", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({ ...user(9), username: "new" }));
		const [err, data] = await users.update({ id: 9, data: { username: "new" } });
		expect(err).toBeNull();
		expect(data?.username).toBe("new");
		expect(lastCall(fetchMock).url).toBe("http://h/api/users/9");
		expect(lastCall(fetchMock).init.method).toBe("PUT");
		expect(JSON.parse(String(lastCall(fetchMock).init.body))).toEqual({ username: "new" });
	});

	it("delete returns the deleted user", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse(user(9)));
		const [err, data] = await users.delete({ id: 9 });
		expect(err).toBeNull();
		expect(data?.id).toBe(9);
		expect(lastCall(fetchMock).init.method).toBe("DELETE");
	});

	it("returns errors and null data for single-object calls", async () => {
		fetchMock.mockResolvedValueOnce(errorResponse(401, "UnauthorizedError", "Missing or invalid credentials"));
		const [err, data] = await users.me();
		expect(err?.status).toBe(401);
		expect(data).toBeNull();
	});

	it("returns NotFoundError when a single body is empty", async () => {
		fetchMock.mockResolvedValueOnce(new Response("", { status: 200 }));
		const [err] = await users.find({ id: 1 });
		expect(err?.name).toBe("NotFoundError");
	});

	it("returns errors for findMany and count", async () => {
		fetchMock.mockResolvedValueOnce(errorResponse(403, "ForbiddenError", "Forbidden"));
		expect((await users.findMany())[0]?.status).toBe(403);
		fetchMock.mockResolvedValueOnce(errorResponse(403, "ForbiddenError", "Forbidden"));
		expect((await users.count())[0]?.status).toBe(403);
	});

	it("count returns 0 for a non-number body", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({ not: "a number" }));
		const [err, total] = await users.count();
		expect(err).toBeNull();
		expect(total).toBe(0);
	});

	it("findMany returns [] for a non-array JSON body", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({ not: "an array" }));
		const [err, data] = await users.findMany();
		expect(err).toBeNull();
		expect(data).toEqual([]);
	});
});
