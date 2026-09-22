import { access } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import type { GenerateConfig } from "../config";

/** Config filenames looked for, in order, when `--config` names no path. */
export const CONFIG_FILENAMES = [
	"strapi-codegen.config.ts",
	"strapi-codegen.config.mts",
	"strapi-codegen.config.js",
	"strapi-codegen.config.mjs",
	"strapi-codegen.config.json",
] as const;

/** How to find and import the config. `importModule` is injected so tests need no real files. */
export interface LoadConfigOptions {
	cwd: string;
	path?: string;
	importModule?: (url: string) => Promise<unknown>;
}

async function exists(file: string): Promise<boolean> {
	try {
		await access(file);
		return true;
	} catch {
		return false;
	}
}

async function findConfig(options: LoadConfigOptions): Promise<string> {
	if (options.path !== undefined) {
		const target = isAbsolute(options.path) ? options.path : resolve(options.cwd, options.path);
		if (await exists(target)) return target;
		throw new Error(`No config file at ${target}`);
	}
	for (const name of CONFIG_FILENAMES) {
		const candidate = resolve(options.cwd, name);
		if (await exists(candidate)) return candidate;
	}
	throw new Error(`No config file found in ${options.cwd}; looked for ${CONFIG_FILENAMES.join(", ")}`);
}

function assertConfig(value: unknown, file: string): asserts value is GenerateConfig {
	if (typeof value !== "object" || value === null) {
		throw new Error(`${file} has no default export to read the config from`);
	}
	const config = value as Record<string, unknown>;
	if (config["types"] === undefined && config["routes"] === undefined && config["graphql"] === undefined) {
		throw new Error(`${file} declares none of types, routes or graphql`);
	}
	const types = config["types"];
	if (typeof types === "object" && types !== null) {
		const section = types as Record<string, unknown>;
		if (section["dir"] === undefined && section["url"] === undefined) {
			throw new Error(`${file}: types needs dir or url`);
		}
	}
	const routes = config["routes"];
	if (typeof routes === "object" && routes !== null && (routes as Record<string, unknown>)["openapi"] === undefined) {
		throw new Error(`${file}: routes needs openapi`);
	}
	const graphql = config["graphql"];
	if (typeof graphql === "object" && graphql !== null && (graphql as Record<string, unknown>)["url"] === undefined) {
		throw new Error(`${file}: graphql needs url`);
	}
}

/**
 * Loads a generate config.
 *
 * A `.ts` config is imported directly, which Node does from 22.6 onwards; an
 * older runtime says so rather than failing on an unknown file extension.
 */
export async function loadConfig(options: LoadConfigOptions): Promise<GenerateConfig> {
	const file = await findConfig(options);
	const importModule = options.importModule ?? ((url: string) => import(url) as Promise<unknown>);

	let module: unknown;
	try {
		module = await importModule(pathToFileURL(file).href);
	} catch (error) {
		if ((error as { code?: string }).code === "ERR_UNKNOWN_FILE_EXTENSION") {
			throw new Error(
				`${file} needs a Node that strips types (22.6 or newer); use a .mjs or .json config instead`,
				{ cause: error }
			);
		}
		throw error;
	}

	const exported = module as { default?: unknown; config?: unknown };
	const config = exported.default ?? exported.config;
	assertConfig(config, file);
	return config;
}
