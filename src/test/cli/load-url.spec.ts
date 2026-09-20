import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

import { loadFromUrl } from "../../cli/load-url";

const fixture = (name: string) => fileURLToPath(new URL(`../../cli/__fixtures__/admin/${name}`, import.meta.url));

async function fixtureFetch(): Promise<{ fetchMock: ReturnType<typeof vi.fn<typeof fetch>>; calls: () => { url: string; init: RequestInit }[] }> {
	const contentTypes = await readFile(fixture("content-types.json"), "utf8");
	const components = await readFile(fixture("components.json"), "utf8");
	const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
		const url = String(input);
		if (url.endsWith("/admin/login")) {
			return new Response(JSON.stringify({ data: { token: "jwt-1", user: { id: 1 } } }), { status: 200 });
		}
		if (url.endsWith("/content-type-builder/content-types")) {
			return new Response(contentTypes, { status: 200 });
		}
		if (url.endsWith("/content-type-builder/components")) {
			return new Response(components, { status: 200 });
		}
		void init;
		return new Response("not found", { status: 404 });
	});
	return {
		fetchMock,
		calls: () => fetchMock.mock.calls.map(([input, init]) => ({ url: String(input), init: init ?? {} })),
	};
}

describe("loadFromUrl", () => {
	it("logs in, fetches both endpoints with the JWT, and re-nests info", async () => {
		const { fetchMock, calls } = await fixtureFetch();
		const set = await loadFromUrl({ baseURL: "https://cms.example.com/api/", email: "a@b.c", password: "pw", fetch: fetchMock });

		const [login, ct, comp] = calls();
		expect(login?.url).toBe("https://cms.example.com/admin/login");
		expect(login?.init.method).toBe("POST");
		expect(JSON.parse(String(login?.init.body))).toEqual({ email: "a@b.c", password: "pw" });
		expect(new Headers(login?.init.headers).get("content-type")).toBe("application/json");
		expect(ct?.url).toBe("https://cms.example.com/content-type-builder/content-types");
		expect(new Headers(ct?.init.headers).get("authorization")).toBe("Bearer jwt-1");
		expect(comp?.url).toBe("https://cms.example.com/content-type-builder/components");

		expect([...set.contentTypes.keys()].sort()).toEqual([
			"api::article.article",
			"api::author.author",
			"api::homepage.homepage",
			"api::tag.tag",
			"plugin::users-permissions.role",
		]);
		const article = set.contentTypes.get("api::article.article");
		expect(article?.schema.info).toEqual({ singularName: "article", pluralName: "articles", displayName: "Article", description: "" });
		expect(article?.schema.kind).toBe("collectionType");
		expect(article?.schema.pluginOptions?.i18n?.localized).toBe(true);
		expect(article?.schema.attributes["blocks"]?.components).toEqual(["blocks.hero", "blocks.quote"]);

		const seo = set.components.get("shared.seo");
		expect(seo?.category).toBe("shared");
		expect(seo?.schema.info).toEqual({ displayName: "Seo", icon: "search", description: "" });
		expect(seo?.schema.attributes["metaTitle"]?.required).toBe(true);
	});

	it("reports failed login with the server message", async () => {
		const fetchMock = vi.fn<typeof fetch>(async () =>
			new Response(JSON.stringify({ data: null, error: { status: 400, name: "ApplicationError", message: "Invalid credentials" } }), { status: 400 })
		);
		await expect(loadFromUrl({ baseURL: "http://h", email: "a", password: "b", fetch: fetchMock })).rejects.toThrow(
			"Admin login failed (400): Invalid credentials"
		);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("names the missing permission on 403", async () => {
		const fetchMock = vi.fn<typeof fetch>(async (input) => {
			if (String(input).endsWith("/admin/login")) return new Response(JSON.stringify({ data: { token: "t" } }), { status: 200 });
			return new Response(JSON.stringify({ data: null, error: { status: 403, name: "ForbiddenError", message: "Forbidden" } }), { status: 403 });
		});
		await expect(loadFromUrl({ baseURL: "http://h", email: "a", password: "b", fetch: fetchMock })).rejects.toThrow(
			/plugin::content-type-builder\.read/
		);
	});

	it("rejects a login body without a token", async () => {
		const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ data: {} }), { status: 200 }));
		await expect(loadFromUrl({ baseURL: "http://h", email: "a", password: "b", fetch: fetchMock })).rejects.toThrow(/token/);
	});

	it("rejects a builder response without a data array", async () => {
		const fetchMock = vi.fn<typeof fetch>(async (input) => {
			if (String(input).endsWith("/admin/login")) return new Response(JSON.stringify({ data: { token: "t" } }), { status: 200 });
			return new Response(JSON.stringify({ nope: true }), { status: 200 });
		});
		await expect(loadFromUrl({ baseURL: "http://h", email: "a", password: "b", fetch: fetchMock })).rejects.toThrow(
			/content-type-builder\/content-types/
		);
	});

	it("uses the global fetch when none is injected", async () => {
		const { fetchMock } = await fixtureFetch();
		vi.stubGlobal("fetch", fetchMock);
		try {
			const set = await loadFromUrl({ baseURL: "http://h", email: "a", password: "b" });
			expect(set.components.size).toBe(3);
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it("falls back to the response status text when the login error body has no message", async () => {
		const fetchMock = vi.fn<typeof fetch>(
			async () => new Response(JSON.stringify({ data: null }), { status: 500, statusText: "Internal Server Error" })
		);
		await expect(loadFromUrl({ baseURL: "http://h", email: "a", password: "b", fetch: fetchMock })).rejects.toThrow(
			"Admin login failed (500): Internal Server Error"
		);
	});

	it("falls back to 'unknown error' when the failed response has neither a message nor a status text", async () => {
		const fetchMock = vi.fn<typeof fetch>(async () => new Response("", { status: 500 }));
		await expect(loadFromUrl({ baseURL: "http://h", email: "a", password: "b", fetch: fetchMock })).rejects.toThrow(
			"Admin login failed (500): unknown error"
		);
	});

	it("treats a non-JSON response body as raw text rather than failing to parse", async () => {
		const fetchMock = vi.fn<typeof fetch>(async () => new Response("server exploded", { status: 500 }));
		await expect(loadFromUrl({ baseURL: "http://h", email: "a", password: "b", fetch: fetchMock })).rejects.toThrow(
			"Admin login failed (500): unknown error"
		);
	});

	it("treats a login response with a non-object data field as if there were no token", async () => {
		const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ data: null }), { status: 200 }));
		await expect(loadFromUrl({ baseURL: "http://h", email: "a", password: "b", fetch: fetchMock })).rejects.toThrow(/token/);
	});

	it("throws when a content-type-builder request fails with a non-permission status", async () => {
		const fetchMock = vi.fn<typeof fetch>(async (input) => {
			if (String(input).endsWith("/admin/login")) return new Response(JSON.stringify({ data: { token: "t" } }), { status: 200 });
			return new Response(JSON.stringify({ error: { message: "Boom" } }), { status: 500, statusText: "Server Error" });
		});
		await expect(loadFromUrl({ baseURL: "http://h", email: "a", password: "b", fetch: fetchMock })).rejects.toThrow(
			/content-type-builder\/content-types failed \(500\): Boom/
		);
	});

	it("passes through arbitrary options and defaults missing attributes to {}", async () => {
		const fetchMock = vi.fn<typeof fetch>(async (input) => {
			const url = String(input);
			if (url.endsWith("/admin/login")) return new Response(JSON.stringify({ data: { token: "t" } }), { status: 200 });
			if (url.endsWith("/content-type-builder/content-types")) {
				return new Response(
					JSON.stringify({
						data: [
							{
								uid: "api::minimal.minimal",
								apiID: "minimal",
								schema: {
									displayName: "Minimal",
									singularName: "minimal",
									pluralName: "minimals",
									kind: "collectionType",
									options: { draftAndPublish: false },
								},
							},
						],
					}),
					{ status: 200 }
				);
			}
			return new Response(
				JSON.stringify({
					data: [
						{
							uid: "minimal.empty",
							category: "minimal",
							apiId: "empty",
							schema: { displayName: "Empty", options: { foo: true } },
						},
					],
				}),
				{ status: 200 }
			);
		});

		const set = await loadFromUrl({ baseURL: "http://h", email: "a", password: "b", fetch: fetchMock });

		const contentType = set.contentTypes.get("api::minimal.minimal");
		expect(contentType?.schema.attributes).toEqual({});
		expect(contentType?.schema.options).toEqual({ draftAndPublish: false });
		expect(contentType?.schema.info).toEqual({ singularName: "minimal", pluralName: "minimals", displayName: "Minimal" });

		const component = set.components.get("minimal.empty");
		expect(component?.schema.attributes).toEqual({});
		expect(component?.schema.options).toEqual({ foo: true });
		expect(component?.schema.info).toEqual({ displayName: "Empty" });
	});
});
