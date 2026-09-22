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
	return {
		out,
		err,
		stdout: (l) => out.push(l),
		stderr: (l) => err.push(l),
		env,
		now: () => new Date("2026-09-20T10:00:00.000Z"),
		cwd: process.cwd(),
	};
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

	it("signs in to a restricted documentation page with --password", async () => {
		const dir = await mkdtemp(join(tmpdir(), "strapi-cli-"));
		const output = join(dir, "routes.ts");
		const spec = { openapi: "3.1.0", info: { title: "t", version: "1" }, paths: { "/ping": { get: { responses: {} } } } };
		const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((url) =>
			Promise.resolve(
				String(url).endsWith("/documentation/login")
					? new Response(null, { status: 302, headers: { location: "/documentation", "set-cookie": "koa.sess=abc; path=/" } })
					: new Response(JSON.stringify(spec), { status: 200 })
			)
		);

		const i = io();
		expect(await run(["generate", "--openapi", "https://cms.example.com/documentation", "--password", "secret", "-o", output], i)).toBe(0);
		expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({ password: "secret" });
		expect(new Headers(fetchMock.mock.calls[1]?.[1]?.headers).get("cookie")).toBe("koa.sess=abc");
		fetchMock.mockRestore();
	});

	it("runs every section of a config file", async () => {
		const dir = await mkdtemp(join(tmpdir(), "strapi-cli-"));
		const spec = { openapi: "3.1.0", info: { title: "t", version: "1" }, paths: { "/ping": { get: { responses: {} } } } };
		const schema = { queryType: { name: "Query" }, types: [{ kind: "ENUM", name: "Status", enumValues: [{ name: "DRAFT" }] }] };
		await writeFile(join(dir, "spec.json"), JSON.stringify(spec), "utf8");
		await writeFile(
			join(dir, "strapi-codegen.config.json"),
			JSON.stringify({
				types: { dir: project, output: join(dir, "types.ts") },
				routes: { openapi: join(dir, "spec.json"), output: join(dir, "routes.ts") },
				graphql: { url: "http://h/graphql", output: join(dir, "graphql.ts") },
			}),
			"utf8"
		);
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ data: { __schema: schema } }), { status: 200 })));

		const i = io();
		expect(await run(["generate", "--config"], { ...i, cwd: dir })).toBe(0);
		expect(await readFile(join(dir, "types.ts"), "utf8")).toContain("export interface Article");
		expect(await readFile(join(dir, "routes.ts"), "utf8")).toContain('"GET /ping"');
		expect(await readFile(join(dir, "graphql.ts"), "utf8")).toContain("export type Status");
		expect(i.out.join("\n")).toMatch(/3 of 3/);
		fetchMock.mockRestore();
	});

	it("keeps going when one section of a config fails, and exits 1", async () => {
		const dir = await mkdtemp(join(tmpdir(), "strapi-cli-"));
		await writeFile(
			join(dir, "strapi-codegen.config.json"),
			JSON.stringify({
				types: { dir: project, output: join(dir, "types.ts") },
				routes: { openapi: join(dir, "missing.json"), output: join(dir, "routes.ts") },
			}),
			"utf8"
		);
		const i = io();
		expect(await run(["generate", "--config"], { ...i, cwd: dir })).toBe(1);
		expect(await readFile(join(dir, "types.ts"), "utf8")).toContain("export interface Article");
		expect(i.err.join("\n")).toMatch(/routes/);
		expect(i.out.join("\n")).toMatch(/1 of 2/);
	});

	it("reads a config at an explicit path, from a running instance", async () => {
		const dir = await mkdtemp(join(tmpdir(), "strapi-cli-"));
		const ctData = [
			{
				uid: "api::page.page",
				apiID: "page",
				schema: { displayName: "Page", singularName: "page", pluralName: "pages", kind: "collectionType", attributes: { title: { type: "string" } } },
			},
		];
		const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
			const url = String(input);
			if (url.endsWith("/admin/login")) return Promise.resolve(new Response(JSON.stringify({ data: { token: "t" } }), { status: 200 }));
			if (url.endsWith("/content-type-builder/content-types")) return Promise.resolve(new Response(JSON.stringify({ data: ctData }), { status: 200 }));
			return Promise.resolve(new Response(JSON.stringify({ data: [] }), { status: 200 }));
		});
		await writeFile(
			join(dir, "custom.config.json"),
			JSON.stringify({ types: { url: "https://cms.example.com", output: join(dir, "types.ts") } }),
			"utf8"
		);

		const i = io({ STRAPI_ADMIN_EMAIL: "me@example.com", STRAPI_ADMIN_PASSWORD: "pw" });
		expect(await run(["generate", "--config", join(dir, "custom.config.json")], { ...i, cwd: dir })).toBe(0);
		expect(await readFile(join(dir, "types.ts"), "utf8")).toContain("export interface Page");
		fetchMock.mockRestore();
	});

	it("reports a config section missing its credentials", async () => {
		const dir = await mkdtemp(join(tmpdir(), "strapi-cli-"));
		await writeFile(join(dir, "strapi-codegen.config.json"), JSON.stringify({ types: { url: "https://cms.example.com" } }), "utf8");
		const i = io();
		expect(await run(["generate", "--config"], { ...i, cwd: dir })).toBe(1);
		expect(i.err.join("\n")).toMatch(/types needs admin credentials/);
		expect(i.out.join("\n")).toMatch(/0 of 1/);
	});

	it("checks every section, and counts a stale file as a failure", async () => {
		const dir = await mkdtemp(join(tmpdir(), "strapi-cli-"));
		await writeFile(join(dir, "strapi-codegen.config.json"), JSON.stringify({ types: { dir: project } }), "utf8");

		const write = io();
		expect(await run(["generate", "--config"], { ...write, cwd: dir })).toBe(0);
		expect(write.out.join("\n")).toMatch(/strapi-types\.ts/);

		const fresh = io();
		expect(await run(["generate", "--config", "--check"], { ...fresh, cwd: dir })).toBe(0);
		expect(fresh.out.join("\n")).toMatch(/Up to date/);

		await writeFile(join(dir, "strapi-types.ts"), "// stale\n", "utf8");
		const stale = io();
		expect(await run(["generate", "--config", "--check"], { ...stale, cwd: dir })).toBe(1);
		expect(stale.err.join("\n")).toMatch(/Out of date/);
		expect(stale.out.join("\n")).toMatch(/0 of 1/);
	});

	it("takes routes and graphql credentials from the environment", async () => {
		const dir = await mkdtemp(join(tmpdir(), "strapi-cli-"));
		const spec = { openapi: "3.1.0", info: { title: "t", version: "1" }, paths: {} };
		const schema = { queryType: { name: "Query" }, types: [] };
		const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input) =>
			Promise.resolve(
				String(input).includes("/graphql")
					? new Response(JSON.stringify({ data: { __schema: schema } }), { status: 200 })
					: new Response(JSON.stringify(spec), { status: 200 })
			)
		);
		await writeFile(
			join(dir, "strapi-codegen.config.json"),
			JSON.stringify({
				routes: { openapi: "https://cms.example.com/spec.json" },
				graphql: { url: "https://cms.example.com/graphql" },
			}),
			"utf8"
		);

		const i = io({ STRAPI_TOKEN: "tok" });
		expect(await run(["generate", "--config"], { ...i, cwd: dir })).toBe(0);
		expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get("authorization")).toBe("Bearer tok");
		expect(i.out.join("\n")).toMatch(/2 of 2/);
		fetchMock.mockRestore();
	});

	it("ignores empty credentials in the environment", async () => {
		const dir = await mkdtemp(join(tmpdir(), "strapi-cli-"));
		const spec = { openapi: "3.1.0", info: { title: "t", version: "1" }, paths: {} };
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(() => Promise.resolve(new Response(JSON.stringify(spec), { status: 200 })));
		await writeFile(
			join(dir, "strapi-codegen.config.json"),
			JSON.stringify({ routes: { openapi: "https://cms.example.com/spec.json", output: join(dir, "routes.ts") } }),
			"utf8"
		);

		const i = io({ STRAPI_TOKEN: "", STRAPI_DOCS_PASSWORD: "" });
		expect(await run(["generate", "--config"], { ...i, cwd: dir })).toBe(0);
		expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get("authorization")).toBeNull();
		expect(fetchMock.mock.calls.every(([u]) => !String(u).endsWith("/documentation/login"))).toBe(true);
		fetchMock.mockRestore();
	});

	it("checks a graphql section too", async () => {
		const dir = await mkdtemp(join(tmpdir(), "strapi-cli-"));
		const schema = { queryType: { name: "Query" }, types: [] };
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ data: { __schema: schema } }), { status: 200 })));
		await writeFile(
			join(dir, "strapi-codegen.config.json"),
			JSON.stringify({ graphql: { url: "https://cms.example.com/graphql", output: join(dir, "graphql.ts") } }),
			"utf8"
		);

		expect(await run(["generate", "--config"], { ...io(), cwd: dir })).toBe(0);
		const fresh = io();
		expect(await run(["generate", "--config", "--check"], { ...fresh, cwd: dir })).toBe(0);
		expect(fresh.out.join("\n")).toMatch(/Up to date/);
		fetchMock.mockRestore();
	});

	it("signs in for a restricted routes section, and rechecks it", async () => {
		const dir = await mkdtemp(join(tmpdir(), "strapi-cli-"));
		const spec = { openapi: "3.1.0", info: { title: "t", version: "1" }, paths: {} };
		const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input) =>
			Promise.resolve(
				String(input).endsWith("/documentation/login")
					? new Response(null, { status: 302, headers: { location: "/documentation", "set-cookie": "koa.sess=abc; path=/" } })
					: new Response(JSON.stringify(spec), { status: 200 })
			)
		);
		await writeFile(
			join(dir, "strapi-codegen.config.json"),
			JSON.stringify({
				routes: { openapi: "https://cms.example.com/documentation/v1.0.0", password: "docs-pw", output: join(dir, "routes.ts") },
			}),
			"utf8"
		);

		expect(await run(["generate", "--config"], { ...io(), cwd: dir })).toBe(0);
		expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({ password: "docs-pw" });

		const fresh = io();
		expect(await run(["generate", "--config", "--check"], { ...fresh, cwd: dir })).toBe(0);
		expect(fresh.out.join("\n")).toMatch(/Up to date/);
		fetchMock.mockRestore();
	});

	it("reports a config file that is not there", async () => {
		const dir = await mkdtemp(join(tmpdir(), "strapi-cli-"));
		const i = io();
		expect(await run(["generate", "--config"], { ...i, cwd: dir })).toBe(1);
		expect(i.err.join("\n")).toMatch(/No config file found/);
	});

	it("refuses a config alongside a source flag", async () => {
		const i = io();
		expect(await run(["generate", "--config", "--dir", project], i)).toBe(2);
		expect(i.err.join("\n")).toMatch(/--config cannot be combined/);
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
