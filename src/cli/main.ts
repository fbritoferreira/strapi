import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";

import { emit } from "./emit";
import { emitGraphql } from "./emit-graphql";
import { emitRoutes } from "./emit-routes";
import { graphqlModel } from "./graphql";
import { loadFromDir } from "./load-dir";
import { loadGraphqlSchema } from "./load-graphql";
import { loadOpenapi } from "./load-openapi";
import { loadFromUrl } from "./load-url";
import { normalize } from "./normalize";
import { routesModel } from "./openapi";
import type { SchemaSet } from "./schema";

export interface Io {
	stdout: (line: string) => void;
	stderr: (line: string) => void;
	env: Record<string, string | undefined>;
	now: () => Date;
}

const USAGE = `Usage: strapi-client generate (--dir <path> | --url <baseURL> | --openapi <spec> | --graphql <url>) [options]

Generate TypeScript types and the StrapiContentTypes/StrapiSingleTypes
registry from a Strapi 5 project's content-type schemas, or the StrapiRoutes
registry from an OpenAPI document, or TypeScript types from the GraphQL
schema of a Strapi instance running @strapi/plugin-graphql.

Sources (exactly one):
  --dir <path>          Strapi project root (reads src/api/**/schema.json and src/components/**/*.json)
  --url <baseURL>       Running Strapi instance; logs in to the admin API and reads the Content-Type Builder
  --openapi <spec>      OpenAPI document (file path or URL) from \`strapi openapi generate\`; emits route types
  --graphql <url>       GraphQL endpoint of a running instance (e.g. http://localhost:1337/graphql); emits schema types

Options:
  --email <email>       Admin email for --url (or STRAPI_ADMIN_EMAIL)
  --password <pass>     Admin password for --url (or STRAPI_ADMIN_PASSWORD)
  --token <token>       Bearer token sent with --openapi URLs and --graphql (or STRAPI_TOKEN)
  -o, --output <file>   Output file (default: strapi-types.ts; strapi-routes.ts for --openapi, strapi-graphql.ts for --graphql)
  --include-plugins     Also emit plugin content types (api::* only by default)
  --check               Exit 1 if the output file is missing or out of date; write nothing
  -h, --help            Show this help`;

interface Parsed {
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
		...(values.dir !== undefined && { dir: values.dir }),
		...(values.url !== undefined && { url: values.url }),
		...(values.openapi !== undefined && { openapi: values.openapi }),
		...(values.graphql !== undefined && { graphql: values.graphql }),
		...(values.email !== undefined && { email: values.email }),
		...(values.password !== undefined && { password: values.password }),
		...(values.token !== undefined && { token: values.token }),
		...(values.output !== undefined && { output: values.output }),
		includePlugins: values["include-plugins"] ?? false,
		check: values.check ?? false,
		help: values.help ?? false,
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
		parsed = parse(rest);
	} catch (error) {
		io.stderr(`Error: ${(error as Error).message}`);
		io.stderr(USAGE);
		return 2;
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
			const document = await loadOpenapi({
				source: parsedSource.spec,
				...(token !== undefined && token !== "" && { token }),
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
