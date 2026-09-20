import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { loadFromDir } from "../../cli/load-dir";

const project = fileURLToPath(new URL("../../cli/__fixtures__/project", import.meta.url));

describe("loadFromDir", () => {
	it("loads content types keyed by api uid", async () => {
		const set = await loadFromDir(project);
		expect([...set.contentTypes.keys()].sort()).toEqual([
			"api::article.article",
			"api::author.author",
			"api::homepage.homepage",
			"api::tag.tag",
		]);
		const article = set.contentTypes.get("api::article.article");
		expect(article?.schema.kind).toBe("collectionType");
		expect(article?.schema.info.pluralName).toBe("articles");
		expect(article?.schema.attributes["title"]?.type).toBe("string");
		expect(set.contentTypes.get("api::homepage.homepage")?.schema.kind).toBe("singleType");
	});

	it("loads components keyed by category.name", async () => {
		const set = await loadFromDir(project);
		expect([...set.components.keys()].sort()).toEqual(["blocks.hero", "blocks.quote", "shared.seo"]);
		expect(set.components.get("shared.seo")?.category).toBe("shared");
		expect(set.components.get("blocks.hero")?.schema.info.displayName).toBe("Hero");
	});

	it("tolerates a project without components", async () => {
		const root = await mkdtemp(join(tmpdir(), "strapi-gen-"));
		await mkdir(join(root, "src/api/thing/content-types/thing"), { recursive: true });
		await writeFile(
			join(root, "src/api/thing/content-types/thing/schema.json"),
			JSON.stringify({ kind: "collectionType", info: { singularName: "thing", pluralName: "things", displayName: "Thing" }, attributes: {} })
		);
		const set = await loadFromDir(root);
		expect(set.contentTypes.size).toBe(1);
		expect(set.components.size).toBe(0);
	});

	it("rejects a schema without attributes, naming the file", async () => {
		const root = await mkdtemp(join(tmpdir(), "strapi-gen-"));
		await mkdir(join(root, "src/api/bad/content-types/bad"), { recursive: true });
		const file = join(root, "src/api/bad/content-types/bad/schema.json");
		await writeFile(file, JSON.stringify({ kind: "collectionType", info: { singularName: "bad", pluralName: "bads", displayName: "Bad" } }));
		await expect(loadFromDir(root)).rejects.toThrow(file);
	});

	it("rejects invalid JSON, naming the file", async () => {
		const root = await mkdtemp(join(tmpdir(), "strapi-gen-"));
		await mkdir(join(root, "src/api"), { recursive: true });
		await mkdir(join(root, "src/components/x"), { recursive: true });
		const file = join(root, "src/components/x/y.json");
		await writeFile(file, "{ not json");
		await expect(loadFromDir(root)).rejects.toThrow(file);
	});

	it("rejects a root without src/api", async () => {
		const root = await mkdtemp(join(tmpdir(), "strapi-gen-"));
		await expect(loadFromDir(root)).rejects.toThrow(/src\/api/);
	});

	it("skips api folders without content-types and content-type folders without schema.json", async () => {
		const root = await mkdtemp(join(tmpdir(), "strapi-gen-"));
		await mkdir(join(root, "src/api/empty"), { recursive: true });
		await mkdir(join(root, "src/api/hasct/content-types/nofile"), { recursive: true });
		await mkdir(join(root, "src/api/good/content-types/good"), { recursive: true });
		await writeFile(
			join(root, "src/api/good/content-types/good/schema.json"),
			JSON.stringify({ kind: "collectionType", info: { singularName: "good", pluralName: "goods", displayName: "Good" }, attributes: {} })
		);
		const set = await loadFromDir(root);
		expect([...set.contentTypes.keys()]).toEqual(["api::good.good"]);
	});

	it("rejects an unreadable schema file, naming the file", async () => {
		const root = await mkdtemp(join(tmpdir(), "strapi-gen-"));
		const file = join(root, "src/api/thing/content-types/thing/schema.json");
		// schema.json exists but is a directory, so it fails to read as a file.
		await mkdir(file, { recursive: true });
		await expect(loadFromDir(root)).rejects.toThrow(file);
	});

	it("rejects a schema JSON that isn't an object, naming the file", async () => {
		const root = await mkdtemp(join(tmpdir(), "strapi-gen-"));
		await mkdir(join(root, "src/api/bad/content-types/bad"), { recursive: true });
		const file = join(root, "src/api/bad/content-types/bad/schema.json");
		await writeFile(file, JSON.stringify("not an object"));
		await expect(loadFromDir(root)).rejects.toThrow(file);
	});

	it("rejects a schema without info, naming the file", async () => {
		const root = await mkdtemp(join(tmpdir(), "strapi-gen-"));
		await mkdir(join(root, "src/api/bad/content-types/bad"), { recursive: true });
		const file = join(root, "src/api/bad/content-types/bad/schema.json");
		await writeFile(file, JSON.stringify({ kind: "collectionType", attributes: {} }));
		await expect(loadFromDir(root)).rejects.toThrow(file);
	});

	it("rejects a schema with attributes: null, naming the file", async () => {
		const root = await mkdtemp(join(tmpdir(), "strapi-gen-"));
		await mkdir(join(root, "src/api/bad/content-types/bad"), { recursive: true });
		const file = join(root, "src/api/bad/content-types/bad/schema.json");
		await writeFile(
			file,
			JSON.stringify({ kind: "collectionType", info: { singularName: "bad", pluralName: "bads", displayName: "Bad" }, attributes: null })
		);
		await expect(loadFromDir(root)).rejects.toThrow(file);
	});

	it("rejects a schema with info: [], naming the file", async () => {
		const root = await mkdtemp(join(tmpdir(), "strapi-gen-"));
		await mkdir(join(root, "src/api/bad/content-types/bad"), { recursive: true });
		const file = join(root, "src/api/bad/content-types/bad/schema.json");
		await writeFile(file, JSON.stringify({ kind: "collectionType", info: [], attributes: {} }));
		await expect(loadFromDir(root)).rejects.toThrow(file);
	});
});
