import { access, readFile } from "node:fs/promises";
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
	/**
	 * Imports a fresh copy rather than the one Node cached, for re-reading a
	 * config that changed. Modules the config itself imports stay cached.
	 */
	version?: number;
}

/** A loaded config and the file it came from. */
export interface LoadedConfig {
	file: string;
	config: GenerateConfig;
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
	const watch = config["watch"];
	if (watch !== undefined) {
		if (typeof watch !== "object" || watch === null) {
			throw new Error(`${file}: watch must be an object`);
		}
		const interval = (watch as Record<string, unknown>)["interval"];
		if (interval !== undefined && (typeof interval !== "number" || !Number.isFinite(interval) || interval <= 0)) {
			throw new Error(`${file}: watch.interval must be a positive number of milliseconds`);
		}
	}
}

async function importConfig(file: string, options: LoadConfigOptions): Promise<unknown> {
	if (file.endsWith(".json")) {
		const text = await readFile(file, "utf8");
		try {
			// Typed boundary: parsed JSON of unknown shape, narrowed by assertConfig.
			return { default: JSON.parse(text) as unknown };
		} catch (error) {
			throw new Error(`${file} is not valid JSON: ${(error as Error).message}`, { cause: error });
		}
	}
	const importModule = options.importModule ?? ((url: string) => import(url) as Promise<unknown>);
	const url = pathToFileURL(file).href + (options.version === undefined ? "" : `?v=${options.version}`);
	try {
		return await importModule(url);
	} catch (error) {
		if ((error as { code?: string }).code === "ERR_UNKNOWN_FILE_EXTENSION") {
			throw new Error(
				`${file} needs a Node that strips types (22.18+ or 23.6+, or 22.6+ with --experimental-strip-types); use a .mjs or .json config instead`,
				{ cause: error }
			);
		}
		throw error;
	}
}

/**
 * Loads a generate config.
 *
 * A `.ts` config is imported directly, which Node does from 22.6 onwards; an
 * older runtime says so rather than failing on an unknown file extension. A
 * `.json` config is read and parsed, since Node imports JSON only with an
 * import attribute.
 */
export async function loadConfig(options: LoadConfigOptions): Promise<GenerateConfig> {
	return (await loadConfigFile(options)).config;
}

/** {@link loadConfig}, also returning which file it read. */
export async function loadConfigFile(options: LoadConfigOptions): Promise<LoadedConfig> {
	const file = await findConfig(options);
	const exported = (await importConfig(file, options)) as { default?: unknown; config?: unknown };
	const config = exported.default ?? exported.config;
	assertConfig(config, file);
	return { file, config };
}
