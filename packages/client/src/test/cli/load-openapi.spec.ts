import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { loadOpenapi } from "../../cli/load-openapi";

const document = { openapi: "3.1.0", info: { title: "t", version: "1" }, paths: { "/ping": { get: { responses: {} } } } };

async function writeSpec(body: unknown): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), "strapi-openapi-"));
	const file = join(dir, "spec.json");
	await writeFile(file, JSON.stringify(body), "utf8");
	return file;
}

const swaggerPage = (spec: unknown) =>
	`<!DOCTYPE html><html><head><title>Swagger UI</title></head><body><div id="swagger-ui"></div>
<script>window.onload = function() { window.ui = SwaggerUIBundle({ spec: ${JSON.stringify(spec)}, dom_id: "#swagger-ui", deepLinking: true }); };</script>
</body></html>`;

describe("loadOpenapi from a documentation page", () => {
	it("reads the spec the Swagger UI page inlines", async () => {
		const fetchImpl = vi.fn().mockResolvedValue(
			new Response(swaggerPage(document), { status: 200, headers: { "content-type": "text/html" } })
		);
		expect(await loadOpenapi({ source: "https://cms.example.com/documentation/v1.0.0", fetch: fetchImpl })).toEqual(document);
	});

	it("reads it from a saved page on disk too", async () => {
		const dir = await mkdtemp(join(tmpdir(), "strapi-openapi-"));
		const file = join(dir, "documentation.html");
		await writeFile(file, swaggerPage(document), "utf8");
		expect(await loadOpenapi({ source: file })).toEqual(document);
	});

	it("keeps braces inside strings from ending the spec early", async () => {
		const tricky = { ...document, info: { title: "a } b", version: "1" } };
		const fetchImpl = vi.fn().mockResolvedValue(new Response(swaggerPage(tricky), { status: 200 }));
		expect(await loadOpenapi({ source: "https://cms.example.com/documentation", fetch: fetchImpl })).toEqual(tricky);
	});

	it("rejects a page with no spec in it", async () => {
		const fetchImpl = vi.fn().mockResolvedValue(new Response("<html><body>nothing here</body></html>", { status: 200 }));
		await expect(loadOpenapi({ source: "https://cms.example.com/documentation", fetch: fetchImpl })).rejects.toThrow(/not valid JSON/);
	});

	it("keeps an escaped quote from ending a string early", async () => {
		const quoted = { ...document, info: { title: 'say "hi" }', version: "1" } };
		const fetchImpl = vi.fn().mockResolvedValue(new Response(swaggerPage(quoted), { status: 200 }));
		expect(await loadOpenapi({ source: "https://cms.example.com/documentation", fetch: fetchImpl })).toEqual(quoted);
	});

	it("rejects a page that mentions a spec but inlines no object", async () => {
		const fetchImpl = vi.fn().mockResolvedValue(new Response("<html><script>spec: null</script></html>", { status: 200 }));
		await expect(loadOpenapi({ source: "https://cms.example.com/documentation", fetch: fetchImpl })).rejects.toThrow(/not valid JSON/);
	});

	it("rejects a page whose spec object is never closed", async () => {
		const truncated = '<html><script>SwaggerUIBundle({ spec: { "openapi": "3.1.0", "paths": {';
		const fetchImpl = vi.fn().mockResolvedValue(new Response(truncated, { status: 200 }));
		await expect(loadOpenapi({ source: "https://cms.example.com/documentation", fetch: fetchImpl })).rejects.toThrow(/not valid JSON/);
	});

	it("rejects a spec written as a JavaScript literal rather than JSON", async () => {
		const literal = "<html><script>SwaggerUIBundle({ spec: { openapi: '3.1.0', paths: {} } });</script></html>";
		const fetchImpl = vi.fn().mockResolvedValue(new Response(literal, { status: 200 }));
		await expect(loadOpenapi({ source: "https://cms.example.com/documentation", fetch: fetchImpl })).rejects.toThrow(
			/has a spec that is not valid JSON/
		);
	});

	it("rejects a page whose inlined object is not an OpenAPI document", async () => {
		const fetchImpl = vi.fn().mockResolvedValue(new Response(swaggerPage({ nope: true }), { status: 200 }));
		await expect(loadOpenapi({ source: "https://cms.example.com/documentation", fetch: fetchImpl })).rejects.toThrow(/OpenAPI 3/);
	});
});

describe("loadOpenapi behind restricted access", () => {
	const loginOk = () =>
		new Response(null, {
			status: 302,
			headers: { location: "https://cms.example.com/documentation", "set-cookie": "koa.sess=abc; path=/; httponly" },
		});

	it("logs in with the documentation password and reuses the session", async () => {
		const fetchImpl = vi
			.fn()
			.mockResolvedValueOnce(loginOk())
			.mockResolvedValueOnce(new Response(swaggerPage(document), { status: 200 }));

		expect(
			await loadOpenapi({ source: "https://cms.example.com/documentation/v1.0.0", password: "secret", fetch: fetchImpl })
		).toEqual(document);

		const [loginUrl, loginInit] = fetchImpl.mock.calls[0] ?? [];
		expect(loginUrl).toBe("https://cms.example.com/documentation/login");
		expect(loginInit?.method).toBe("POST");
		expect(JSON.parse(String(loginInit?.body))).toEqual({ password: "secret" });

		const [, specInit] = fetchImpl.mock.calls[1] ?? [];
		expect(new Headers(specInit?.headers).get("cookie")).toBe("koa.sess=abc");
	});

	it("reports a wrong password", async () => {
		const fetchImpl = vi.fn().mockResolvedValue(
			new Response(null, { status: 302, headers: { location: "https://cms.example.com/documentation?error=password" } })
		);
		await expect(
			loadOpenapi({ source: "https://cms.example.com/documentation", password: "nope", fetch: fetchImpl })
		).rejects.toThrow(/password/i);
	});

	it("reports a login that hands back no session", async () => {
		const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: "/documentation" } }));
		await expect(
			loadOpenapi({ source: "https://cms.example.com/documentation", password: "secret", fetch: fetchImpl })
		).rejects.toThrow(/session cookie/);
	});

	it("reports the status when the login itself fails", async () => {
		const fetchImpl = vi.fn().mockResolvedValue(new Response("boom", { status: 500, statusText: "Internal Server Error" }));
		await expect(
			loadOpenapi({ source: "https://cms.example.com/documentation", password: "secret", fetch: fetchImpl })
		).rejects.toThrow(/login failed \(500\)/);
	});

	it("points a 500 at the session middleware the plugin needs", async () => {
		const fetchImpl = vi.fn().mockResolvedValue(new Response("boom", { status: 500, statusText: "Internal Server Error" }));
		await expect(
			loadOpenapi({ source: "https://cms.example.com/documentation", password: "secret", fetch: fetchImpl })
		).rejects.toThrow(/strapi::session/);
	});

	it("leaves a 4xx login without that hint", async () => {
		const fetchImpl = vi.fn().mockResolvedValue(new Response("nope", { status: 403, statusText: "Forbidden" }));
		await expect(
			loadOpenapi({ source: "https://cms.example.com/documentation", password: "secret", fetch: fetchImpl })
		).rejects.toThrow(/login failed \(403\): Forbidden$/);
	});

	it("falls back to a bare status when the login has no status text", async () => {
		const fetchImpl = vi.fn().mockResolvedValue(new Response("boom", { status: 503, statusText: "" }));
		await expect(
			loadOpenapi({ source: "https://cms.example.com/documentation", password: "secret", fetch: fetchImpl })
		).rejects.toThrow(/login failed \(503\): unknown error/);
	});

	it("reports a login that answers without redirecting at all", async () => {
		const fetchImpl = vi.fn().mockResolvedValue(new Response("", { status: 200 }));
		await expect(
			loadOpenapi({ source: "https://cms.example.com/documentation", password: "secret", fetch: fetchImpl })
		).rejects.toThrow(/session cookie/);
	});

	it("says a password is needed when the docs redirect to their login page", async () => {
		const login = new Response("<html>login form</html>", { status: 200 });
		Object.defineProperty(login, "url", { value: "https://cms.example.com/documentation/login" });
		const fetchImpl = vi.fn().mockResolvedValue(login);
		await expect(loadOpenapi({ source: "https://cms.example.com/documentation", fetch: fetchImpl })).rejects.toThrow(
			/--password/
		);
	});
});

describe("loadOpenapi", () => {
	it("reads a spec from a file", async () => {
		expect(await loadOpenapi({ source: await writeSpec(document) })).toEqual(document);
	});

	it("reads a spec over http", async () => {
		const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify(document), { status: 200 }));
		expect(await loadOpenapi({ source: "https://cms.example.com/spec.json", fetch: fetchImpl })).toEqual(document);
		expect(fetchImpl.mock.calls[0]?.[0]).toBe("https://cms.example.com/spec.json");
	});

	it("sends a bearer token when one is configured", async () => {
		const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify(document), { status: 200 }));
		await loadOpenapi({ source: "https://cms.example.com/spec.json", token: "tok", fetch: fetchImpl });
		const headers = new Headers(fetchImpl.mock.calls[0]?.[1]?.headers);
		expect(headers.get("authorization")).toBe("Bearer tok");
	});

	it("rejects a document that is not a JSON object", async () => {
		await expect(loadOpenapi({ source: await writeSpec([1, 2]) })).rejects.toThrow(/expected a JSON object/);
	});

	it("uses the global fetch when none is passed", async () => {
		const globalFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(document), { status: 200 }));
		expect(await loadOpenapi({ source: "https://cms.example.com/spec.json" })).toEqual(document);
		expect(globalFetch).toHaveBeenCalledOnce();
		globalFetch.mockRestore();
	});

	it("reports the status when the fetch fails", async () => {
		const fetchImpl = vi.fn().mockResolvedValue(new Response("nope", { status: 404 }));
		await expect(loadOpenapi({ source: "https://cms.example.com/spec.json", fetch: fetchImpl })).rejects.toThrow(/404/);
	});

	it("rejects a file that is not an OpenAPI 3 document", async () => {
		await expect(loadOpenapi({ source: await writeSpec({ swagger: "2.0", paths: {} }) })).rejects.toThrow(/OpenAPI 3/);
	});

	it("rejects a document with no paths", async () => {
		await expect(loadOpenapi({ source: await writeSpec({ openapi: "3.1.0", info: {} }) })).rejects.toThrow(/paths/);
	});

	it("reports invalid JSON with the source in the message", async () => {
		const dir = await mkdtemp(join(tmpdir(), "strapi-openapi-"));
		const file = join(dir, "spec.json");
		await writeFile(file, "{ not json", "utf8");
		await expect(loadOpenapi({ source: file })).rejects.toThrow(/spec\.json/);
	});
});
