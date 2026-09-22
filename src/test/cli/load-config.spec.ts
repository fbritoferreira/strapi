import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { CONFIG_FILENAMES, loadConfig } from "../../cli/load-config";

const config = { types: { url: "https://cms.example.com" } };

async function dirWith(name: string, contents = "unused"): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), "strapi-config-"));
	await writeFile(join(dir, name), contents, "utf8");
	return dir;
}

describe("loadConfig", () => {
	it("reads the default export", async () => {
		const dir = await dirWith("strapi-codegen.config.ts");
		const importModule = vi.fn().mockResolvedValue({ default: config });
		expect(await loadConfig({ cwd: dir, importModule })).toEqual(config);
		expect(String(importModule.mock.calls[0]?.[0])).toMatch(/^file:\/\/.*strapi-codegen\.config\.ts$/);
	});

	it("reads a named `config` export too", async () => {
		const dir = await dirWith("strapi-codegen.config.ts");
		expect(await loadConfig({ cwd: dir, importModule: vi.fn().mockResolvedValue({ config }) })).toEqual(config);
	});

	it("takes an explicit path", async () => {
		const dir = await dirWith("custom.config.ts");
		const importModule = vi.fn().mockResolvedValue({ default: config });
		expect(await loadConfig({ cwd: dir, path: join(dir, "custom.config.ts"), importModule })).toEqual(config);
	});

	it("resolves a relative path against the working directory", async () => {
		const dir = await dirWith("nested.config.ts");
		const importModule = vi.fn().mockResolvedValue({ default: config });
		expect(await loadConfig({ cwd: dir, path: "nested.config.ts", importModule })).toEqual(config);
	});

	it("looks for each known filename in order", async () => {
		const dir = await dirWith("strapi-codegen.config.json", JSON.stringify(config));
		expect(await loadConfig({ cwd: dir, importModule: vi.fn().mockResolvedValue({ default: config }) })).toEqual(config);
		expect(CONFIG_FILENAMES[0]).toBe("strapi-codegen.config.ts");
	});

	it("reports that no config file was found", async () => {
		const dir = await mkdtemp(join(tmpdir(), "strapi-config-"));
		await expect(loadConfig({ cwd: dir, importModule: vi.fn() })).rejects.toThrow(/No config file found/);
	});

	it("reports an explicit path that does not exist", async () => {
		const dir = await mkdtemp(join(tmpdir(), "strapi-config-"));
		await expect(loadConfig({ cwd: dir, path: join(dir, "nope.ts"), importModule: vi.fn() })).rejects.toThrow(/nope\.ts/);
	});

	it("explains a Node that cannot import TypeScript", async () => {
		const dir = await dirWith("strapi-codegen.config.ts");
		const importModule = vi.fn().mockRejectedValue(Object.assign(new Error("Unknown file extension"), { code: "ERR_UNKNOWN_FILE_EXTENSION" }));
		await expect(loadConfig({ cwd: dir, importModule })).rejects.toThrow(/Node 22\.6|\.mjs|\.json/);
	});

	it("passes any other import failure through", async () => {
		const dir = await dirWith("strapi-codegen.config.ts");
		const importModule = vi.fn().mockRejectedValue(new Error("boom"));
		await expect(loadConfig({ cwd: dir, importModule })).rejects.toThrow(/boom/);
	});

	it("rejects a module that exports no config", async () => {
		const dir = await dirWith("strapi-codegen.config.ts");
		await expect(loadConfig({ cwd: dir, importModule: vi.fn().mockResolvedValue({}) })).rejects.toThrow(/default export/);
	});

	it("rejects a config with no section", async () => {
		const dir = await dirWith("strapi-codegen.config.ts");
		await expect(
			loadConfig({ cwd: dir, importModule: vi.fn().mockResolvedValue({ default: {} }) })
		).rejects.toThrow(/types, routes or graphql/);
	});

	it("rejects a routes section naming no document", async () => {
		const dir = await dirWith("strapi-codegen.config.ts");
		await expect(
			loadConfig({ cwd: dir, importModule: vi.fn().mockResolvedValue({ default: { routes: {} } }) })
		).rejects.toThrow(/routes needs openapi/);
	});

	it("rejects a graphql section naming no endpoint", async () => {
		const dir = await dirWith("strapi-codegen.config.ts");
		await expect(
			loadConfig({ cwd: dir, importModule: vi.fn().mockResolvedValue({ default: { graphql: {} } }) })
		).rejects.toThrow(/graphql needs url/);
	});

	it("rejects a types section naming neither dir nor url", async () => {
		const dir = await dirWith("strapi-codegen.config.ts");
		await expect(
			loadConfig({ cwd: dir, importModule: vi.fn().mockResolvedValue({ default: { types: {} } }) })
		).rejects.toThrow(/types needs dir or url/);
	});
});
