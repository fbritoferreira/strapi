/**
 * Packs the package the way `pnpm publish` does, extracts the tarball, and
 * boots `strapi-server.js` from it.
 *
 * Why pack instead of importing ../dist: the repo root .gitignore has `dist/`,
 * and without a `files` whitelist pnpm strips it from the tarball — 1.2.0 and
 * 1.2.1 both published with only dist/index.js, so every plugin load died on
 * "Cannot find module ./dist/controllers/admin.js". Importing the local build
 * cannot see that; the tarball is the only artifact that matters.
 */
import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const tmp = await mkdtemp(join(tmpdir(), "admin-api-pack-"));

execFileSync("pnpm", ["pack", "--pack-destination", tmp], { stdio: "pipe" });
const tarball = (await readdir(tmp)).find((f) => f.endsWith(".tgz"));
assert.ok(tarball, "pnpm pack produced no tarball");

execFileSync("tar", ["-xzf", join(tmp, tarball), "-C", tmp], { stdio: "pipe" });

const { default: createPlugin } = await import(
	pathToFileURL(join(tmp, "package", "strapi-server.js")).href
);
const plugin = createPlugin();

assert.deepEqual(
	Object.keys(plugin.controllers).sort(),
	["adminController", "tokenController"],
	"strapi-server.js must export both controllers",
);
assert.equal(plugin.routes.length, 13, "expected 13 routes");
for (const route of plugin.routes) {
	assert.equal(
		typeof route.handler,
		"string",
		`route ${route.path} must use a controller.method handler string`,
	);
	assert.match(route.handler, /\.\w+$/, `route ${route.path} has no method`);
}

console.log(`smoke ok: tarball loads, ${plugin.routes.length} routes registered`);
