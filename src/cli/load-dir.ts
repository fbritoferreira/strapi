import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

import type { ComponentEntry, ContentTypeEntry, RawComponentSchema, RawContentTypeSchema, SchemaSet } from "./schema";

async function isDirectory(path: string): Promise<boolean> {
	try {
		return (await stat(path)).isDirectory();
	} catch {
		return false;
	}
}

async function readJson(file: string): Promise<Record<string, unknown>> {
	let text: string;
	try {
		text = await readFile(file, "utf8");
	} catch (error) {
		throw new Error(`Cannot read ${file}: ${(error as Error).message}`, { cause: error });
	}
	try {
		const parsed: unknown = JSON.parse(text);
		if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
			throw new Error("not a JSON object");
		}
		return parsed as Record<string, unknown>;
	} catch (error) {
		throw new Error(`Invalid JSON in ${file}: ${(error as Error).message}`, { cause: error });
	}
}

function requireSchema(file: string, raw: Record<string, unknown>): void {
	const info = raw["info"];
	if (raw["attributes"] === undefined || typeof raw["attributes"] !== "object") {
		throw new Error(`Schema ${file} has no "attributes" object`);
	}
	if (info === null || typeof info !== "object") {
		throw new Error(`Schema ${file} has no "info" object`);
	}
}

export async function loadFromDir(root: string): Promise<SchemaSet> {
	const apiDir = join(root, "src", "api");
	if (!(await isDirectory(apiDir))) {
		throw new Error(`${apiDir} is not a directory; --dir must point at a Strapi project root (containing src/api)`);
	}

	const contentTypes = new Map<string, ContentTypeEntry>();
	for (const api of (await readdir(apiDir, { withFileTypes: true })).filter((d) => d.isDirectory())) {
		const ctDir = join(apiDir, api.name, "content-types");
		if (!(await isDirectory(ctDir))) continue;
		for (const ct of (await readdir(ctDir, { withFileTypes: true })).filter((d) => d.isDirectory())) {
			const file = join(ctDir, ct.name, "schema.json");
			if (!(await stat(file).catch(() => null))) continue;
			const raw = await readJson(file);
			requireSchema(file, raw);
			// Typed boundary: requireSchema validated attributes and info above.
			const schema = raw as unknown as RawContentTypeSchema;
			contentTypes.set(`api::${api.name}.${schema.info.singularName}`, { uid: `api::${api.name}.${schema.info.singularName}`, schema });
		}
	}

	const components = new Map<string, ComponentEntry>();
	const componentsDir = join(root, "src", "components");
	if (await isDirectory(componentsDir)) {
		for (const category of (await readdir(componentsDir, { withFileTypes: true })).filter((d) => d.isDirectory())) {
			const categoryDir = join(componentsDir, category.name);
			for (const entry of (await readdir(categoryDir, { withFileTypes: true })).filter((d) => d.isFile() && d.name.endsWith(".json"))) {
				const file = join(categoryDir, entry.name);
				const raw = await readJson(file);
				requireSchema(file, raw);
				const uid = `${category.name}.${entry.name.slice(0, -".json".length)}`;
				// Typed boundary: requireSchema validated attributes and info above.
				components.set(uid, { uid, category: category.name, schema: raw as unknown as RawComponentSchema });
			}
		}
	}

	return { contentTypes, components };
}
