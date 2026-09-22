import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";

import { emit } from "./emit";
import { emitGraphql } from "./emit-graphql";
import { emitRoutes } from "./emit-routes";
import { graphqlModel } from "./graphql";
import { loadFromDir } from "./load-dir";
import { CONFIG_FILENAMES, loadConfig } from "./load-config";
import { loadGraphqlSchema } from "./load-graphql";
import { loadOpenapi } from "./load-openapi";
import { loadFromUrl } from "./load-url";
import { normalize } from "./normalize";
import { routesModel } from "./openapi";
import type { SchemaSet } from "./schema";
import type { GenerateConfig, GraphqlGeneration, RoutesGeneration, TypesGeneration } from "../config";

export interface Io {
	stdout: (line: string) => void;
	stderr: (line: string) => void;
	env: Record<string, string | undefined>;
	now: () => Date;
	/** Directory a relative `--config` path and the default config filenames resolve against. */
	cwd: string;
}

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
	includePlugins: boolean;
	check: boolean;
	help: boolean;
}

type Source =
	| { kind: "dir"; root: string }
	| { kind: "url"; url: string }
	| { kind: "openapi"; spec: string }
	| { kind: "graphql"; url: string };

/** Default output file per source kind. */
const DEFAULT_OUTPUT: Record<Source["kind"], string> = {
	dir: "strapi-types.ts",
	url: "strapi-types.ts",
	openapi: "strapi-routes.ts",
	graphql: "strapi-graphql.ts",
};

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
			"include-plugins": { type: "boolean", default: false },
			check: { type: "boolean", default: false },
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
		includePlugins: values["include-plugins"] === true,
		check: values.check === true,
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

/** One generated file: its label for messages, and the work that writes it. */
interface Task {
	name: string;
	/** @returns the summary line to print, or a `--check` exit code. */
	run: () => Promise<{ line: string } | { status: number }>;
}

function typesTask(section: TypesGeneration, check: boolean, io: Io): Task {
	return {
		name: "types",
		run: async () => {
			const target = resolve(io.cwd, section.output ?? DEFAULT_OUTPUT.dir);
			let set: SchemaSet;
			let source: string;
			if (section.dir !== undefined) {
				const root = resolve(io.cwd, section.dir);
				source = `dir ${root}`;
				set = await loadFromDir(root);
			} else {
				const url = section.url;
				const email = section.email ?? io.env["STRAPI_ADMIN_EMAIL"];
				const password = section.password ?? io.env["STRAPI_ADMIN_PASSWORD"];
				if (email === undefined || email === "" || password === undefined || password === "") {
					throw new Error("types needs admin credentials: email/password, or STRAPI_ADMIN_EMAIL/STRAPI_ADMIN_PASSWORD");
				}
				source = `url ${url}`;
				set = await loadFromUrl({ baseURL: url, email, password });
			}
			const model = normalize(set, { includePlugins: section.includePlugins === true });
			const output = emit(model, { source, generatedAt: io.now() });
			const status = await write(output, target, check, io);
			return status === null ? { line: `Wrote ${target} (${model.types.length} types)` } : { status };
		},
	};
}

function routesTask(section: RoutesGeneration, check: boolean, io: Io): Task {
	return {
		name: "routes",
		run: async () => {
			const target = resolve(io.cwd, section.output ?? DEFAULT_OUTPUT.openapi);
			const token = section.token ?? io.env["STRAPI_TOKEN"];
			const password = section.password ?? io.env["STRAPI_DOCS_PASSWORD"];
			const document = await loadOpenapi({
				source: section.openapi,
				...(token !== undefined && token !== "" && { token }),
				...(password !== undefined && password !== "" && { password }),
			});
			const model = routesModel(document);
			const output = emitRoutes(model, { source: `openapi ${section.openapi}`, generatedAt: io.now() });
			const status = await write(output, target, check, io);
			return status === null ? { line: `Wrote ${target} (${model.routes.length} routes)` } : { status };
		},
	};
}

function graphqlTask(section: GraphqlGeneration, check: boolean, io: Io): Task {
	return {
		name: "graphql",
		run: async () => {
			const target = resolve(io.cwd, section.output ?? DEFAULT_OUTPUT.graphql);
			const token = section.token ?? io.env["STRAPI_TOKEN"];
			const schema = await loadGraphqlSchema({
				url: section.url,
				...(token !== undefined && token !== "" && { token }),
			});
			const model = graphqlModel(schema);
			const output = emitGraphql(model, { source: `graphql ${section.url}`, generatedAt: io.now() });
			const status = await write(output, target, check, io);
			return status === null ? { line: `Wrote ${target} (${model.types.length} types)` } : { status };
		},
	};
}

function tasksOf(config: GenerateConfig, check: boolean, io: Io): Task[] {
	return [
		...(config.types !== undefined ? [typesTask(config.types, check, io)] : []),
		...(config.routes !== undefined ? [routesTask(config.routes, check, io)] : []),
		...(config.graphql !== undefined ? [graphqlTask(config.graphql, check, io)] : []),
	];
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

	const tasks = tasksOf(config, parsed.check, io);
	let done = 0;
	let failures = 0;
	for (const task of tasks) {
		try {
			const result = await task.run();
			if ("line" in result) {
				io.stdout(result.line);
				done += 1;
			} else if (result.status === 0) {
				done += 1;
			} else {
				failures += 1;
			}
		} catch (error) {
			io.stderr(`Error (${task.name}): ${(error as Error).message}`);
			failures += 1;
		}
	}
	io.stdout(`${done} of ${tasks.length} generated`);
	return failures === 0 ? 0 : 1;
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

	if (parsed.config !== undefined) {
		if (parsed.dir !== undefined || parsed.url !== undefined || parsed.openapi !== undefined || parsed.graphql !== undefined) {
			io.stderr("Error: --config cannot be combined with --dir, --url, --openapi or --graphql");
			io.stderr(USAGE);
			return 2;
		}
		return runConfig(parsed, io);
	}

	const sources: Source[] = [
		...(parsed.dir !== undefined ? [{ kind: "dir", root: resolve(parsed.dir) } as const] : []),
		...(parsed.url !== undefined ? [{ kind: "url", url: parsed.url } as const] : []),
		...(parsed.openapi !== undefined ? [{ kind: "openapi", spec: parsed.openapi } as const] : []),
		...(parsed.graphql !== undefined ? [{ kind: "graphql", url: parsed.graphql } as const] : []),
	];
	const parsedSource = sources.length === 1 ? sources[0] : undefined;
	if (parsedSource === undefined) {
		io.stderr("Error: pass exactly one of --dir, --url, --openapi or --graphql");
		io.stderr(USAGE);
		return 2;
	}
	const target = resolve(parsed.output ?? DEFAULT_OUTPUT[parsedSource.kind]);

	const token = parsed.token ?? io.env["STRAPI_TOKEN"];

	try {
		if (parsedSource.kind === "graphql") {
			const schema = await loadGraphqlSchema({
				url: parsedSource.url,
				...(token !== undefined && token !== "" && { token }),
			});
			const model = graphqlModel(schema);
			const output = emitGraphql(model, { source: `graphql ${parsedSource.url}`, generatedAt: io.now() });
			const status = await write(output, target, parsed.check, io);
			if (status !== null) return status;
			io.stdout(`Wrote ${target} (${model.types.length} types)`);
			return 0;
		}

		if (parsedSource.kind === "openapi") {
			const docsPassword = parsed.password ?? io.env["STRAPI_DOCS_PASSWORD"];
			const document = await loadOpenapi({
				source: parsedSource.spec,
				...(token !== undefined && token !== "" && { token }),
				...(docsPassword !== undefined && docsPassword !== "" && { password: docsPassword }),
			});
			const model = routesModel(document);
			const output = emitRoutes(model, { source: `openapi ${parsedSource.spec}`, generatedAt: io.now() });
			const status = await write(output, target, parsed.check, io);
			if (status !== null) return status;
			io.stdout(`Wrote ${target} (${model.routes.length} routes)`);
			return 0;
		}

		let set: SchemaSet;
		let source: string;
		if (parsedSource.kind === "dir") {
			source = `dir ${parsedSource.root}`;
			set = await loadFromDir(parsedSource.root);
		} else {
			const email = parsed.email ?? io.env["STRAPI_ADMIN_EMAIL"];
			const password = parsed.password ?? io.env["STRAPI_ADMIN_PASSWORD"];
			if (email === undefined || email === "" || password === undefined || password === "") {
				io.stderr("Error: --url needs admin credentials: --email/--password or STRAPI_ADMIN_EMAIL/STRAPI_ADMIN_PASSWORD");
				return 2;
			}
			source = `url ${parsedSource.url}`;
			set = await loadFromUrl({ baseURL: parsedSource.url, email, password });
		}

		const model = normalize(set, { includePlugins: parsed.includePlugins });
		const output = emit(model, { source, generatedAt: io.now() });
		const status = await write(output, target, parsed.check, io);
		if (status !== null) return status;
		io.stdout(`Wrote ${target} (${model.types.length} types)`);
		return 0;
	} catch (error) {
		io.stderr(`Error: ${(error as Error).message}`);
		return 1;
	}
}
