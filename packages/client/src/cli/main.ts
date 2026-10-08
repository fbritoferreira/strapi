import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";

import { CONFIG_FILENAMES, loadConfig, loadConfigFile } from "./load-config";
import { resolveSpec, sectionsOf, timedFetch } from "./sections";
import { watch, type WatchedSection, type WatchFn, type WatchPlan } from "./watch";
import type { GenerateConfig } from "../config";

export interface Io {
	stdout: (line: string) => void;
	stderr: (line: string) => void;
	env: Record<string, string | undefined>;
	/** Directory a relative `--config` path and the default config filenames resolve against. */
	cwd: string;
	/** Stops `--watch` when aborted; the CLI aborts it on SIGINT and SIGTERM. */
	signal: AbortSignal;
	/** File watcher for `--watch`. Default `fs.watch`. */
	watch?: WatchFn;
}

/** Milliseconds between polls of a URL source under `--watch`. */
const DEFAULT_INTERVAL_MS = 2000;

/** How long one request of a poll may take before it counts as the instance being down. */
const REQUEST_TIMEOUT_MS = 10_000;

const USAGE = `Usage: strapi-client generate (--config [file] | --dir <path> | --url <baseURL> | --openapi <spec> | --graphql <url>) [options]

Generate TypeScript types and the StrapiContentTypes/StrapiSingleTypes
registry from a Strapi 5 project's content-type schemas, or the StrapiRoutes
registry from an OpenAPI document, or TypeScript types from the GraphQL
schema of a Strapi instance running @strapi/plugin-graphql.

Sources (exactly one, or --config for all of them):
  --config [file]       Run every section of a config file (default: one of
                        ${CONFIG_FILENAMES.join(", ")})
  --dir <path>          Strapi project root (reads src/api/**/schema.json and src/components/**/*.json)
  --url <baseURL>       Running Strapi instance; logs in to the admin API and reads the Content-Type Builder
  --openapi <spec>      OpenAPI document (file path or URL), or a documentation-plugin page; emits route types
  --graphql <url>       GraphQL endpoint of a running instance (e.g. http://localhost:1337/graphql); emits schema types

Options:
  --email <email>       Admin email for --url (or STRAPI_ADMIN_EMAIL)
  --password <pass>     Admin password for --url (or STRAPI_ADMIN_PASSWORD); documentation password for a
                        restricted --openapi page (or STRAPI_DOCS_PASSWORD)
  --token <token>       Bearer token sent with --openapi URLs and --graphql (or STRAPI_TOKEN)
  -o, --output <file>   Output file (default: strapi-types.ts; strapi-routes.ts for --openapi, strapi-graphql.ts for --graphql)
  --include-plugins     Also emit plugin content types (api::* only by default)
  --check               Exit 1 if the output file is missing or out of date; write nothing
  --watch               Generate, then keep regenerating as the source changes: schema files for
                        --dir, the document for a local --openapi file, the config file itself for
                        --config; URL sources are polled. Stop with Ctrl-C
  --interval <ms>       Milliseconds between polls of a URL source under --watch (default ${DEFAULT_INTERVAL_MS})
  -h, --help            Show this help`;

interface Parsed {
	config?: string;
	dir?: string;
	url?: string;
	openapi?: string;
	graphql?: string;
	email?: string;
	password?: string;
	token?: string;
	output?: string;
	interval?: string;
	includePlugins: boolean;
	check: boolean;
	watch: boolean;
	help: boolean;
}

type Source =
	| { kind: "dir"; root: string }
	| { kind: "url"; url: string }
	| { kind: "openapi"; spec: string }
	| { kind: "graphql"; url: string };

function parse(args: string[]): Parsed {
	const { values } = parseArgs({
		args,
		strict: true,
		allowPositionals: false,
		options: {
			config: { type: "string" },
			dir: { type: "string" },
			url: { type: "string" },
			openapi: { type: "string" },
			graphql: { type: "string" },
			email: { type: "string" },
			password: { type: "string" },
			token: { type: "string" },
			output: { type: "string", short: "o" },
			interval: { type: "string" },
			"include-plugins": { type: "boolean", default: false },
			check: { type: "boolean", default: false },
			watch: { type: "boolean", default: false },
			help: { type: "boolean", short: "h", default: false },
		},
	});
	return {
		...(values.config !== undefined && { config: values.config }),
		...(values.dir !== undefined && { dir: values.dir }),
		...(values.url !== undefined && { url: values.url }),
		...(values.openapi !== undefined && { openapi: values.openapi }),
		...(values.graphql !== undefined && { graphql: values.graphql }),
		...(values.email !== undefined && { email: values.email }),
		...(values.password !== undefined && { password: values.password }),
		...(values.token !== undefined && { token: values.token }),
		...(values.output !== undefined && { output: values.output }),
		...(values.interval !== undefined && { interval: values.interval }),
		includePlugins: values["include-plugins"] === true,
		check: values.check === true,
		watch: values.watch === true,
		help: values.help === true,
	};
}

function stripHeader(text: string): string {
	const newline = text.indexOf("\n");
	return newline === -1 ? "" : text.slice(newline + 1);
}

/**
 * Writes `output` to `target`, or compares against it under `--check`.
 *
 * @returns the exit code to return, or `null` when the file was written and the
 * caller should print its own summary line.
 */
async function write(output: string, target: string, check: boolean, io: Io): Promise<number | null> {
	if (check) {
		let existing: string | null;
		try {
			existing = await readFile(target, "utf8");
		} catch {
			existing = null;
		}
		if (existing !== null && stripHeader(existing) === stripHeader(output)) {
			io.stdout(`Up to date: ${target}`);
			return 0;
		}
		io.stderr(`Out of date: ${target} (run without --check to update)`);
		return 1;
	}
	await mkdir(dirname(target), { recursive: true });
	await writeFile(target, output, "utf8");
	return null;
}

/**
 * Runs every section of the config, carrying on after a failure so one broken
 * source does not hide the rest.
 */
async function runConfig(parsed: Parsed, io: Io): Promise<number> {
	let config: GenerateConfig;
	try {
		config = await loadConfig({ cwd: io.cwd, ...(parsed.config !== "" && { path: parsed.config }) });
	} catch (error) {
		io.stderr(`Error: ${(error as Error).message}`);
		return 1;
	}

	const sections = sectionsOf(config, io);
	let done = 0;
	let failures = 0;
	for (const section of sections) {
		try {
			const generated = await section.produce();
			const status = await write(generated.output, generated.target, parsed.check, io);
			if (status === null) io.stdout(`Wrote ${generated.target} (${generated.summary})`);
			if (status === 1) failures += 1;
			else done += 1;
		} catch (error) {
			io.stderr(`Error (${section.name}): ${(error as Error).message}`);
			failures += 1;
		}
	}
	io.stdout(`${done} of ${sections.length} generated`);
	return failures === 0 ? 0 : 1;
}

/** The one-section config a single-source invocation stands for. */
function configOf(source: Source, parsed: Parsed): GenerateConfig {
	const output = parsed.output === undefined ? {} : { output: parsed.output };
	const token = parsed.token === undefined ? {} : { token: parsed.token };
	const password = parsed.password === undefined ? {} : { password: parsed.password };
	switch (source.kind) {
		case "dir":
			return { types: { dir: source.root, includePlugins: parsed.includePlugins, ...output } };
		case "url":
			return {
				types: {
					url: source.url,
					includePlugins: parsed.includePlugins,
					...(parsed.email !== undefined && { email: parsed.email }),
					...password,
					...output,
				},
			};
		case "openapi":
			return { routes: { openapi: source.spec, ...token, ...password, ...output } };
		case "graphql":
			return { graphql: { url: source.url, ...token, ...output } };
	}
}

/**
 * Checks the flags that only make sense with `--watch`.
 *
 * @returns the poll interval the flags ask for, or an error message.
 */
function watchFlags(parsed: Parsed): { interval?: number } | { error: string } {
	if (parsed.watch && parsed.check) return { error: "--watch cannot be combined with --check" };
	if (parsed.interval === undefined) return {};
	if (!parsed.watch) return { error: "--interval needs --watch" };
	const interval = /^\d+$/.test(parsed.interval) ? Number(parsed.interval) : 0;
	if (interval <= 0) return { error: "--interval takes a positive number of milliseconds" };
	return { interval };
}

/** Lets `--config` be passed with no value, which `parseArgs` alone cannot express. */
function normalizeConfigFlag(args: string[]): string[] {
	return args.flatMap((arg, index) => {
		if (arg !== "--config") return [arg];
		const next = args[index + 1];
		return next === undefined || next.startsWith("-") ? ["--config="] : [arg];
	});
}

export async function run(argv: string[], io: Io): Promise<number> {
	const [command, ...rest] = argv;
	if (argv.includes("--help") || argv.includes("-h")) {
		io.stdout(USAGE);
		return 0;
	}
	if (command !== "generate") {
		io.stderr(USAGE);
		return 2;
	}

	let parsed: Parsed;
	try {
		parsed = parse(normalizeConfigFlag(rest));
	} catch (error) {
		io.stderr(`Error: ${(error as Error).message}`);
		io.stderr(USAGE);
		return 2;
	}

	const flags = watchFlags(parsed);
	if ("error" in flags) {
		io.stderr(`Error: ${flags.error}`);
		io.stderr(USAGE);
		return 2;
	}
	const requestOptions = { fetch: timedFetch(REQUEST_TIMEOUT_MS) };

	if (parsed.config !== undefined) {
		if (parsed.dir !== undefined || parsed.url !== undefined || parsed.openapi !== undefined || parsed.graphql !== undefined) {
			io.stderr("Error: --config cannot be combined with --dir, --url, --openapi or --graphql");
			io.stderr(USAGE);
			return 2;
		}
		if (!parsed.watch) return runConfig(parsed, io);
		let version = 0;
		return watch({
			io,
			plan: async (): Promise<WatchPlan> => {
				const { file, config } = await loadConfigFile({
					cwd: io.cwd,
					...(parsed.config !== "" && { path: parsed.config }),
					version: version++,
				});
				return {
					sections: sectionsOf(config, io, requestOptions),
					interval: flags.interval ?? config.watch?.interval ?? DEFAULT_INTERVAL_MS,
					configFile: file,
				};
			},
		});
	}

	const sources: Source[] = [
		...(parsed.dir !== undefined ? [{ kind: "dir", root: resolve(io.cwd, parsed.dir) } as const] : []),
		...(parsed.url !== undefined ? [{ kind: "url", url: parsed.url } as const] : []),
		...(parsed.openapi !== undefined ? [{ kind: "openapi", spec: resolveSpec(parsed.openapi, io.cwd) } as const] : []),
		...(parsed.graphql !== undefined ? [{ kind: "graphql", url: parsed.graphql } as const] : []),
	];
	const parsedSource = sources.length === 1 ? sources[0] : undefined;
	if (parsedSource === undefined) {
		io.stderr("Error: pass exactly one of --dir, --url, --openapi or --graphql");
		io.stderr(USAGE);
		return 2;
	}
	if (parsedSource.kind === "url") {
		const email = parsed.email ?? io.env["STRAPI_ADMIN_EMAIL"];
		const password = parsed.password ?? io.env["STRAPI_ADMIN_PASSWORD"];
		if (email === undefined || email === "" || password === undefined || password === "") {
			io.stderr("Error: --url needs admin credentials: --email/--password or STRAPI_ADMIN_EMAIL/STRAPI_ADMIN_PASSWORD");
			return 2;
		}
	}
	const config = configOf(parsedSource, parsed);

	if (parsed.watch) {
		return watch({
			io,
			plan: async () => ({ sections: sectionsOf(config, io, requestOptions), interval: flags.interval ?? DEFAULT_INTERVAL_MS }),
		});
	}

	// Typed boundary: a single-source config has exactly one section.
	const [section] = sectionsOf(config, io) as [WatchedSection];
	try {
		const generated = await section.produce();
		const status = await write(generated.output, generated.target, parsed.check, io);
		if (status !== null) return status;
		io.stdout(`Wrote ${generated.target} (${generated.summary})`);
		return 0;
	} catch (error) {
		io.stderr(`Error: ${(error as Error).message}`);
		return 1;
	}
}
