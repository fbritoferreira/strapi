/**
 * Exercises the built package on the oldest Node this library supports, where
 * the test runner itself cannot run: vitest needs Node 22.12 or newer, so
 * without this the `engines` range would be an unverified claim.
 *
 * Runs offline — a stubbed fetch, and the CLI against the committed fixture.
 */
import { strict as assert } from "node:assert";
import { execFile } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { Strapi, StrapiClient, generateConfig } from "../dist/strapi.mjs";

const run = promisify(execFile);
const checks = [];
const check = async (name, fn) => {
	await fn();
	checks.push(name);
};

await check("collection read returns the data tuple", async () => {
	const strapi = new Strapi({
		baseURL: "http://cms.test",
		defaultLocale: "en",
		fetch: async () =>
			new Response(JSON.stringify({ data: [{ id: 1, documentId: "a", title: "A" }], meta: { pagination: { total: 1 } } }), {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
	});
	const [err, data, meta] = await strapi.collection("articles").findMany({ params: { fields: ["title"] } });
	assert.equal(err, null);
	assert.equal(data[0].title, "A");
	assert.equal(meta.pagination.total, 1);
});

await check("an HTTP failure becomes an error tuple, not a throw", async () => {
	const strapi = new Strapi({
		baseURL: "http://cms.test",
		defaultLocale: "en",
		fetch: async () => new Response("nope", { status: 500 }),
	});
	const [err, data] = await strapi.collection("articles").findMany();
	assert.equal(data, null);
	assert.equal(err.status, 500);
});

await check("a timeout is classified, which needs AbortSignal.any", async () => {
	const strapi = new Strapi({
		baseURL: "http://cms.test",
		defaultLocale: "en",
		timeout: 5,
		// The pending timer matters: AbortSignal.timeout() does not keep the event
		// loop alive, so a stub that merely never settles would let Node exit
		// before the timeout fires. A real socket holds the loop open.
		fetch: (_url, init) =>
			new Promise((_resolve, reject) => {
				const stuck = setTimeout(() => reject(new Error("stub never settled")), 10_000);
				init.signal.addEventListener("abort", () => {
					clearTimeout(stuck);
					reject(init.signal.reason);
				});
			}),
	});
	const [err] = await strapi.collection("articles").findMany({ init: { signal: AbortSignal.timeout(50_000) } });
	assert.equal(err.name, "TimeoutError");
});

await check("StrapiClient and generateConfig are exported", () => {
	assert.equal(typeof StrapiClient, "function");
	assert.deepEqual(generateConfig({ graphql: { url: "http://cms.test/graphql" } }), {
		graphql: { url: "http://cms.test/graphql" },
	});
});

await check("the CLI generates from the fixture project", async () => {
	const dir = await mkdtemp(join(tmpdir(), "strapi-smoke-"));
	const out = join(dir, "types.ts");
	await run(process.execPath, ["bin/strapi-client.mjs", "generate", "--dir", "src/cli/__fixtures__/project", "-o", out]);
	const written = await readFile(out, "utf8");
	assert.match(written, /export interface Article extends StrapiDocument/);
	assert.match(written, /interface StrapiContentTypes/);
});

console.log(`smoke: ${checks.length} checks passed on Node ${process.version}`);
for (const name of checks) console.log(`  ok  ${name}`);
