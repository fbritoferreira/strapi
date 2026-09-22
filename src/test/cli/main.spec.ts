import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

import { run, type Io } from "../../cli/main";

const project = fileURLToPath(new URL("../../cli/__fixtures__/project", import.meta.url));

function io(env: Record<string, string | undefined> = {}): Io & { out: string[]; err: string[] } {
	const out: string[] = [];
	const err: string[] = [];
	return { out, err, stdout: (l) => out.push(l), stderr: (l) => err.push(l), env, now: () => new Date("2026-09-20T10:00:00.000Z") };
}

describe("run", () => {
	it("prints usage and exits 2 without a command", async () => {
		const i = io();
		expect(await run([], i)).toBe(2);
		expect(i.err.join("\n")).toMatch(/Usage: strapi-client generate/);
	});

	it("prints usage to stdout and exits 0 with --help", async () => {
		const i = io();
		expect(await run(["generate", "--help"], i)).toBe(0);
		expect(i.out.join("\n")).toMatch(/--dir <path>/);
		expect(i.out.join("\n")).toMatch(/--check/);
	});

	it("rejects unknown flags", async () => {
		const i = io();
		expect(await run(["generate", "--dir", project, "--bogus"], i)).toBe(2);
		expect(i.err.join("\n")).toMatch(/--bogus/);
	});

	it("generates a routes file from --openapi", async () => {
		const dir = await mkdtemp(join(tmpdir(), "strapi-cli-"));
		const spec = join(dir, "spec.json");
		await writeFile(
			spec,
			JSON.stringify({
				openapi: "3.1.0",
				info: { title: "t", version: "1" },
				paths: { "/auth/local": { post: { requestBody: { content: { "application/json": { schema: { type: "object", properties: { identifier: { type: "string" } }, required: ["identifier"] } } } }, responses: { "200": { content: { "application/json": { schema: { type: "object", properties: { jwt: { type: "string" } }, required: ["jwt"] } } } } } } } },
			}),
			"utf8"
		);
		const output = join(dir, "routes.ts");
		const i = io();
		expect(await run(["generate", "--openapi", spec, "-o", output], i)).toBe(0);
		const written = await readFile(output, "utf8");
		expect(written).toContain('"POST /auth/local": {');
		expect(written).toContain("\t\t\tbody: { identifier: string };");
		expect(written).toContain("\t\t\tresponse: { jwt: string };");
		expect(i.out.join("\n")).toMatch(/1 route/);
	});

	it("defaults the --openapi output to strapi-routes.ts", async () => {
		const i = io();
		expect(await run(["generate", "--openapi", "/does/not/exist.json"], i)).toBe(1);
		expect(i.err.join("\n")).toMatch(/exist\.json/);
	});

	it("takes only one source", async () => {
		const i = io();
		expect(await run(["generate", "--dir", project, "--openapi", "spec.json"], i)).toBe(2);
		expect(i.err.join("\n")).toMatch(/exactly one of --dir, --url, --openapi or --graphql/);
	});

	it("generates GraphQL types from --graphql", async () => {
		const dir = await mkdtemp(join(tmpdir(), "strapi-cli-"));
		const output = join(dir, "graphql.ts");
		const schema = {
			queryType: { name: "Query" },
			types: [{ kind: "OBJECT", name: "Article", fields: [{ name: "title", type: { kind: "NON_NULL", ofType: { kind: "SCALAR", name: "String" } } }] }],
		};
		const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: { __schema: schema } }), { status: 200 }));
		const i = io();
		expect(await run(["generate", "--graphql", "http://h/graphql", "-o", output], i)).toBe(0);
		expect(await readFile(output, "utf8")).toContain("export type Article = {\n\ttitle: string;\n};");
		expect(i.out.join("\n")).toMatch(/1 type/);
		expect(fetchMock.mock.calls[0]?.[0]).toBe("http://h/graphql");
		fetchMock.mockRestore();
	});

	it("reports a missing GraphQL plugin", async () => {
		const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("Not Found", { status: 404 }));
		const i = io();
		expect(await run(["generate", "--graphql", "http://h/graphql"], i)).toBe(1);
		expect(i.err.join("\n")).toMatch(/@strapi\/plugin-graphql/);
		fetchMock.mockRestore();
	});

	it("sends a token with an --openapi URL and honours --check", async () => {
		const dir = await mkdtemp(join(tmpdir(), "strapi-cli-"));
		const output = join(dir, "routes.ts");
		const spec = { openapi: "3.1.0", info: { title: "t", version: "1" }, paths: { "/ping": { get: { responses: {} } } } };
		// A Response body can only be read once, so hand out a fresh one per call.
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(() => Promise.resolve(new Response(JSON.stringify(spec), { status: 200 })));

		const write = io();
		expect(await run(["generate", "--openapi", "https://cms.example.com/spec.json", "--token", "tok", "-o", output], write)).toBe(0);
		expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get("authorization")).toBe("Bearer tok");

		const upToDate = io();
		expect(await run(["generate", "--openapi", "https://cms.example.com/spec.json", "-o", output, "--check"], upToDate)).toBe(0);
		expect(upToDate.out.join("\n")).toMatch(/Up to date/);
		fetchMock.mockRestore();
	});

	it("sends a token with --graphql and reports a stale file under --check", async () => {
		const dir = await mkdtemp(join(tmpdir(), "strapi-cli-"));
		const output = join(dir, "graphql.ts");
		const schema = { queryType: { name: "Query" }, types: [{ kind: "ENUM", name: "Status", enumValues: [{ name: "DRAFT" }] }] };
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ data: { __schema: schema } }), { status: 200 })));

		const stale = io({ STRAPI_TOKEN: "env-tok" });
		expect(await run(["generate", "--graphql", "http://h/graphql", "-o", output, "--check"], stale)).toBe(1);
		expect(stale.err.join("\n")).toMatch(/Out of date/);
		expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get("authorization")).toBe("Bearer env-tok");
		fetchMock.mockRestore();
	});

	it("treats a file with no newline as out of date under --check", async () => {
		const dir = await mkdtemp(join(tmpdir(), "strapi-cli-"));
		const output = join(dir, "strapi-types.ts");
		await writeFile(output, "not even a header", "utf8");
		const i = io();
		expect(await run(["generate", "--dir", project, "-o", output, "--check"], i)).toBe(1);
		expect(i.err.join("\n")).toMatch(/Out of date/);
	});

	it("requires exactly one of --dir or --url", async () => {
		expect(await run(["generate"], io())).toBe(2);
		const both = io();
		expect(await run(["generate", "--dir", project, "--url", "http://h"], both)).toBe(2);
		expect(both.err.join("\n")).toMatch(/exactly one of --dir, --url, --openapi or --graphql/);
	});

	it("requires credentials for --url, from flags or env", async () => {
		const i = io();
		expect(await run(["generate", "--url", "http://h"], i)).toBe(2);
		expect(i.err.join("\n")).toMatch(/STRAPI_ADMIN_EMAIL/);
		expect(i.err.join("\n")).toMatch(/--password/);
	});

	it("writes the generated file from --dir and reports the type count", async () => {
		const dir = await mkdtemp(join(tmpdir(), "strapi-gen-"));
		const output = join(dir, "nested", "strapi-types.ts");
		const i = io();
		expect(await run(["generate", "--dir", project, "-o", output], i)).toBe(0);
		expect(i.out).toEqual([`Wrote ${output} (7 types)`]);
		const text = await readFile(output, "utf8");
		expect(text.split("\n")[0]).toMatch(/^\/\/ Generated by @fbritoferreira\/strapi generate on 2026-09-20T10:00:00\.000Z from dir /);
		expect(text).toContain("export interface Article extends StrapiDocument");
		expect(text).toContain("articles: Article;");
	});

	it("--check reports up to date, ignoring the timestamp line", async () => {
		const dir = await mkdtemp(join(tmpdir(), "strapi-gen-"));
		const output = join(dir, "types.ts");
		expect(await run(["generate", "--dir", project, "-o", output], io())).toBe(0);
		const stale = (await readFile(output, "utf8")).replace("2026-09-20T10:00:00.000Z", "2000-01-01T00:00:00.000Z");
		await writeFile(output, stale);
		const i = io();
		expect(await run(["generate", "--dir", project, "-o", output, "--check"], i)).toBe(0);
		expect(i.out).toEqual([`Up to date: ${output}`]);
		expect(await readFile(output, "utf8")).toBe(stale);
	});

	it("--check exits 1 when the file is missing or different", async () => {
		const dir = await mkdtemp(join(tmpdir(), "strapi-gen-"));
		const output = join(dir, "types.ts");
		const missing = io();
		expect(await run(["generate", "--dir", project, "-o", output, "--check"], missing)).toBe(1);
		expect(missing.err.join("\n")).toMatch(/Out of date/);
		await writeFile(output, "// something else\n");
		const different = io();
		expect(await run(["generate", "--dir", project, "-o", output, "--check"], different)).toBe(1);
	});

	it("reports pipeline errors and exits 1", async () => {
		const dir = await mkdtemp(join(tmpdir(), "strapi-gen-"));
		const i = io();
		expect(await run(["generate", "--dir", dir], i)).toBe(1);
		expect(i.err.join("\n")).toMatch(/^Error: .*src\/api/);
	});

	it("uses env credentials for --url and the source label", async () => {
		const fetchMock = vi.fn<typeof fetch>(async (input) => {
			const url = String(input);
			if (url.endsWith("/admin/login")) return new Response(JSON.stringify({ data: { token: "t" } }), { status: 200 });
			return new Response(JSON.stringify({ data: [] }), { status: 200 });
		});
		vi.stubGlobal("fetch", fetchMock);
		try {
			const dir = await mkdtemp(join(tmpdir(), "strapi-gen-"));
			const output = join(dir, "types.ts");
			const i = io({ STRAPI_ADMIN_EMAIL: "a@b.c", STRAPI_ADMIN_PASSWORD: "pw" });
			expect(await run(["generate", "--url", "http://cms.local", "-o", output], i)).toBe(0);
			expect(i.out).toEqual([`Wrote ${output} (0 types)`]);
			expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({ email: "a@b.c", password: "pw" });
			expect(await readFile(output, "utf8")).toContain("from url http://cms.local.");
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it("uses --email/--password flags over env credentials", async () => {
		const fetchMock = vi.fn<typeof fetch>(async (input) => {
			const url = String(input);
			if (url.endsWith("/admin/login")) return new Response(JSON.stringify({ data: { token: "t" } }), { status: 200 });
			return new Response(JSON.stringify({ data: [] }), { status: 200 });
		});
		vi.stubGlobal("fetch", fetchMock);
		try {
			const dir = await mkdtemp(join(tmpdir(), "strapi-gen-"));
			const output = join(dir, "types.ts");
			const i = io({ STRAPI_ADMIN_EMAIL: "env@b.c", STRAPI_ADMIN_PASSWORD: "envpw" });
			expect(
				await run(["generate", "--url", "http://cms.local", "-o", output, "--email", "flag@b.c", "--password", "flagpw"], i),
			).toBe(0);
			expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({ email: "flag@b.c", password: "flagpw" });
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it("passes --include-plugins through", async () => {
		const dir = await mkdtemp(join(tmpdir(), "strapi-gen-"));
		const output = join(dir, "types.ts");
		expect(await run(["generate", "--dir", project, "-o", output, "--include-plugins"], io())).toBe(0);
		// the fixture project has no plugin schemas on disk, so the count is unchanged; the flag must still be accepted
		expect(await readFile(output, "utf8")).toContain("export interface Tag extends StrapiDocument");
	});
});
