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
