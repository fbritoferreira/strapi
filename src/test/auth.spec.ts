import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import { Strapi } from "../index";
import type { StrapiUser } from "../types";
import { installFetchMock, jsonResponse, lastCall, type FetchMock } from "./helpers";

const user = { id: 1, documentId: "u1", username: "me", email: "me@x.io", provider: "local", confirmed: true, blocked: false };

describe("AuthClient", () => {
	let fetchMock: FetchMock;
	let strapi: Strapi;

	beforeEach(() => {
		fetchMock = installFetchMock();
		strapi = new Strapi({ baseURL: "http://h", defaultLocale: "en" });
	});
	afterEach(() => vi.restoreAllMocks());

	const body = () => JSON.parse(String(lastCall(fetchMock).init.body)) as Record<string, unknown>;

	it("logs in with an identifier and password", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({ jwt: "j", refreshToken: "r", user }));
		const [err, session] = await strapi.auth.login({ identifier: "me@x.io", password: "pw" });
		if (err) throw new Error(err.message);
		expect(lastCall(fetchMock).url).toBe("http://h/api/auth/local");
		expect(lastCall(fetchMock).init.method).toBe("POST");
		expect(body()).toEqual({ identifier: "me@x.io", password: "pw" });
		expect(session.jwt).toBe("j");
		expectTypeOf(session.user).toEqualTypeOf<StrapiUser>();
		expectTypeOf(session.refreshToken).toEqualTypeOf<string | undefined>();
	});

	it("registers, where the jwt is absent until the email is confirmed", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({ user }));
		const [err, created] = await strapi.auth.register({ username: "me", email: "me@x.io", password: "pw" });
		if (err) throw new Error(err.message);
		expect(lastCall(fetchMock).url).toBe("http://h/api/auth/local/register");
		expectTypeOf(created.jwt).toEqualTypeOf<string | undefined>();
		expect(created.user.username).toBe("me");
	});

	it("sends the password reset flow", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
		const [, forgot] = await strapi.auth.forgotPassword({ email: "me@x.io" });
		expect(lastCall(fetchMock).url).toBe("http://h/api/auth/forgot-password");
		expect(forgot?.ok).toBe(true);

		fetchMock.mockResolvedValueOnce(jsonResponse({ jwt: "j2", user }));
		await strapi.auth.resetPassword({ code: "c", password: "new", passwordConfirmation: "new" });
		expect(lastCall(fetchMock).url).toBe("http://h/api/auth/reset-password");
		expect(body()).toEqual({ code: "c", password: "new", passwordConfirmation: "new" });
	});

	it("changes a password for the signed-in user", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({ jwt: "j3", user }));
		await strapi.auth.changePassword({ currentPassword: "old", password: "new", passwordConfirmation: "new" });
		expect(lastCall(fetchMock).url).toBe("http://h/api/auth/change-password");
		expect(body()).toEqual({ currentPassword: "old", password: "new", passwordConfirmation: "new" });
	});

	it("resends a confirmation email", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({ email: "me@x.io", sent: true }));
		const [, result] = await strapi.auth.sendEmailConfirmation({ email: "me@x.io" });
		expect(lastCall(fetchMock).url).toBe("http://h/api/auth/send-email-confirmation");
		expect(result?.sent).toBe(true);
	});

	it("refreshes a session", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({ jwt: "j4", refreshToken: "r2" }));
		const [err, refreshed] = await strapi.auth.refresh({ refreshToken: "r" });
		if (err) throw new Error(err.message);
		expect(lastCall(fetchMock).url).toBe("http://h/api/auth/refresh");
		expect(body()).toEqual({ refreshToken: "r" });
		expect(refreshed.jwt).toBe("j4");
	});

	it("explains that refresh needs the refresh mode when Strapi answers 404", async () => {
		fetchMock.mockResolvedValueOnce(new Response("Not Found", { status: 404 }));
		const [err] = await strapi.auth.refresh({ refreshToken: "r" });
		expect(err?.status).toBe(404);
		expect(err?.message).toMatch(/jwtManagement/);
	});

	it("logs out, optionally scoped to one device", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
		await strapi.auth.logout();
		expect(lastCall(fetchMock).url).toBe("http://h/api/auth/logout");
		expect(body()).toEqual({});

		fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
		await strapi.auth.logout({ scope: "all", deviceId: "d1" });
		expect(body()).toEqual({ scope: "all", deviceId: "d1" });
	});

	it("reports an empty body rather than a null session", async () => {
		fetchMock.mockResolvedValueOnce(new Response("", { status: 200 }));
		const [err, session] = await strapi.auth.login({ identifier: "me@x.io", password: "pw" });
		expect(session).toBeNull();
		expect(err?.message).toMatch(/empty body/);
	});

	it("refreshes from a cookie when no token is passed", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({ jwt: "j5" }));
		const [err, refreshed] = await strapi.auth.refresh();
		if (err) throw new Error(err.message);
		expect(body()).toEqual({});
		expect(refreshed.refreshToken).toBeUndefined();
	});

	it("reports an empty refresh body", async () => {
		fetchMock.mockResolvedValueOnce(new Response("", { status: 200 }));
		const [err] = await strapi.auth.refresh({ refreshToken: "r" });
		expect(err?.message).toMatch(/empty body/);
	});

	it("explains a 404 on logout the same way", async () => {
		fetchMock.mockResolvedValueOnce(new Response("Not Found", { status: 404 }));
		const [err] = await strapi.auth.logout();
		expect(err?.message).toMatch(/jwtManagement/);
	});

	it("treats an empty logout body as success", async () => {
		fetchMock.mockResolvedValueOnce(new Response("", { status: 200 }));
		const [err, result] = await strapi.auth.logout();
		if (err) throw new Error(err.message);
		expect(result.ok).toBe(true);
	});

	it("passes other errors through untouched", async () => {
		fetchMock.mockResolvedValueOnce(new Response("boom", { status: 500 }));
		const [err] = await strapi.auth.refresh({ refreshToken: "r" });
		expect(err?.status).toBe(500);
		expect(err?.message).not.toMatch(/jwtManagement/);
	});

	it("sends the jwt on later requests once it is set", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({ jwt: "j", user }));
		const [err, session] = await strapi.auth.login({ identifier: "me@x.io", password: "pw" });
		if (err) throw new Error(err.message);
		expect(new Headers(lastCall(fetchMock).init.headers).get("authorization")).toBeNull();

		strapi.setToken(session.jwt);
		fetchMock.mockResolvedValueOnce(jsonResponse({ data: [] }));
		await strapi.collection("articles").findMany();
		expect(new Headers(lastCall(fetchMock).init.headers).get("authorization")).toBe("Bearer j");

		strapi.setToken(undefined);
		fetchMock.mockResolvedValueOnce(jsonResponse({ data: [] }));
		await strapi.collection("articles").findMany();
		expect(new Headers(lastCall(fetchMock).init.headers).get("authorization")).toBeNull();
	});
});
