import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";

import { emit } from "./emit";
import { loadFromDir } from "./load-dir";
import { loadFromUrl } from "./load-url";
import { normalize } from "./normalize";
import type { SchemaSet } from "./schema";

export interface Io {
	stdout: (line: string) => void;
	stderr: (line: string) => void;
	env: Record<string, string | undefined>;
	now: () => Date;
}

const USAGE = `Usage: strapi-client generate (--dir <path> | --url <baseURL>) [options]

Generate TypeScript types and the StrapiContentTypes/StrapiSingleTypes
registry from a Strapi 5 project's content-type schemas.

Sources (exactly one):
  --dir <path>          Strapi project root (reads src/api/**/schema.json and src/components/**/*.json)
  --url <baseURL>       Running Strapi instance; logs in to the admin API and reads the Content-Type Builder

Options:
  --email <email>       Admin email for --url (or STRAPI_ADMIN_EMAIL)
  --password <pass>     Admin password for --url (or STRAPI_ADMIN_PASSWORD)
  -o, --output <file>   Output file (default: strapi-types.ts)
  --include-plugins     Also emit plugin content types (api::* only by default)
  --check               Exit 1 if the output file is missing or out of date; write nothing
  -h, --help            Show this help`;

interface Parsed {
	dir?: string;
	url?: string;
	email?: string;
	password?: string;
	output: string;
	includePlugins: boolean;
	check: boolean;
	help: boolean;
}

type Source = { kind: "dir"; root: string } | { kind: "url"; url: string };

function parse(args: string[]): Parsed {
	const { values } = parseArgs({
		args,
		strict: true,
		allowPositionals: false,
		options: {
			dir: { type: "string" },
			url: { type: "string" },
			email: { type: "string" },
			password: { type: "string" },
			output: { type: "string", short: "o", default: "strapi-types.ts" },
			"include-plugins": { type: "boolean", default: false },
			check: { type: "boolean", default: false },
			help: { type: "boolean", short: "h", default: false },
		},
	});
	return {
		...(values.dir !== undefined && { dir: values.dir }),
		...(values.url !== undefined && { url: values.url }),
		...(values.email !== undefined && { email: values.email }),
		...(values.password !== undefined && { password: values.password }),
		output: values.output ?? "strapi-types.ts",
		includePlugins: values["include-plugins"] ?? false,
		check: values.check ?? false,
		help: values.help ?? false,
	};
}

function stripHeader(text: string): string {
	const newline = text.indexOf("\n");
	return newline === -1 ? "" : text.slice(newline + 1);
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

	const parsedSource: Source | null =
		parsed.dir !== undefined && parsed.url === undefined
			? { kind: "dir", root: resolve(parsed.dir) }
			: parsed.url !== undefined && parsed.dir === undefined
				? { kind: "url", url: parsed.url }
				: null;
	if (parsedSource === null) {
		io.stderr("Error: pass exactly one of --dir or --url");
		io.stderr(USAGE);
		return 2;
	}

	let set: SchemaSet;
	let source: string;
	try {
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
		const target = resolve(parsed.output);

		if (parsed.check) {
			let existing: string | null = null;
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
		io.stdout(`Wrote ${target} (${model.types.length} types)`);
		return 0;
	} catch (error) {
		io.stderr(`Error: ${(error as Error).message}`);
		return 1;
	}
}
