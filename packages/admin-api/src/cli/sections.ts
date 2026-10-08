import { basename, dirname, relative, resolve, sep } from "node:path";

import { emit } from "./emit";
import { emitGraphql } from "./emit-graphql";
import { emitRoutes } from "./emit-routes";
import { graphqlModel } from "./graphql";
import { loadFromDir } from "./load-dir";
import { loadGraphqlSchema } from "./load-graphql";
import { loadOpenapi } from "./load-openapi";
import { loadFromUrl, type AdminSession } from "./load-url";
import { normalize } from "./normalize";
import { routesModel } from "./openapi";
import type { SchemaSet } from "./schema";
import { displayPath, type WatchedSection } from "./watch";
import type { GenerateConfig, GraphqlGeneration, RoutesGeneration, TypesGeneration } from "../config";

/** Default output file per section. */
export const DEFAULT_OUTPUT = {
	types: "strapi-types.ts",
	routes: "strapi-routes.ts",
	graphql: "strapi-graphql.ts",
} as const;

/** What a section needs from its surroundings. */
export interface SectionIo {
	/** Directory that relative paths in a section resolve against. */
	cwd: string;
	env: Record<string, string | undefined>;
}

export interface SectionOptions {
	/** Used for every request a section makes; the loaders' default otherwise. */
	fetch?: typeof fetch;
}

const HTTP_URL = /^https?:\/\//i;

/** An OpenAPI source, resolved against `cwd` when it is a file rather than a URL. */
export function resolveSpec(spec: string, cwd: string): string {
	return HTTP_URL.test(spec) ? spec : resolve(cwd, spec);
}

/**
 * A local path as the header records it: relative to the output file's
 * directory, with forward slashes, so the header is the same on every machine
 * and from any working directory.
 */
function headerPath(path: string, target: string): string {
	return relative(dirname(target), path).split(sep).join("/") || "./";
}

/** An OpenAPI source as the header records it. */
function specLabel(spec: string, target: string): string {
	return HTTP_URL.test(spec) ? spec : headerPath(spec, target);
}

function present(value: string | undefined): value is string {
	return value !== undefined && value !== "";
}

/**
 * Whether a change below a project's `src` can affect what `loadFromDir`
 * reads: `api/<name>/content-types/**` and `components/<category>/*.json`,
 * plus the directories above them being added or removed.
 */
export function acceptSchemaChange(filename: string | null): boolean {
	if (filename === null) return true;
	const parts = filename.split(/[\\/]/);
	if (parts[0] === "api") return parts.length <= 2 || parts[2] === "content-types";
	if (parts[0] === "components") return parts.length <= 2 || filename.endsWith(".json");
	return false;
}

function typesSection(section: TypesGeneration, io: SectionIo, options: SectionOptions): WatchedSection {
	const target = resolve(io.cwd, section.output ?? DEFAULT_OUTPUT.types);
	const includePlugins = section.includePlugins === true;
	const fetchOption = options.fetch === undefined ? {} : { fetch: options.fetch };

	if (section.dir !== undefined) {
		const root = resolve(io.cwd, section.dir);
		const src = resolve(root, "src");
		return {
			name: "types",
			source: { kind: "files", path: src, recursive: true, label: displayPath(io.cwd, src), accept: acceptSchemaChange },
			produce: async () => {
				const model = normalize(await loadFromDir(root), { includePlugins });
				return { target, output: emit(model, { source: `dir ${headerPath(root, target)}` }), summary: `${model.types.length} types` };
			},
		};
	}

	const url = section.url;
	const session: AdminSession = {};
	return {
		name: "types",
		source: { kind: "poll", url },
		produce: async () => {
			const email = section.email ?? io.env["STRAPI_ADMIN_EMAIL"];
			const password = section.password ?? io.env["STRAPI_ADMIN_PASSWORD"];
			if (!present(email) || !present(password)) {
				throw new Error("types needs admin credentials: email/password, or STRAPI_ADMIN_EMAIL/STRAPI_ADMIN_PASSWORD");
			}
			const set: SchemaSet = await loadFromUrl({ baseURL: url, email, password, session, ...fetchOption });
			const model = normalize(set, { includePlugins });
			return { target, output: emit(model, { source: `url ${url}` }), summary: `${model.types.length} types` };
		},
	};
}

function routesSection(section: RoutesGeneration, io: SectionIo, options: SectionOptions): WatchedSection {
	const target = resolve(io.cwd, section.output ?? DEFAULT_OUTPUT.routes);
	const spec = resolveSpec(section.openapi, io.cwd);
	const name = basename(spec);
	return {
		name: "routes",
		source: HTTP_URL.test(spec)
			? { kind: "poll", url: spec }
			: {
					kind: "files",
					path: dirname(spec),
					recursive: false,
					label: displayPath(io.cwd, spec),
					accept: (filename) => filename === null || filename === name,
				},
		produce: async () => {
			const token = section.token ?? io.env["STRAPI_TOKEN"];
			const password = section.password ?? io.env["STRAPI_DOCS_PASSWORD"];
			const document = await loadOpenapi({
				source: spec,
				...(present(token) && { token }),
				...(present(password) && { password }),
				...(options.fetch !== undefined && { fetch: options.fetch }),
			});
			const model = routesModel(document);
			return {
				target,
				output: emitRoutes(model, { source: `openapi ${specLabel(spec, target)}` }),
				summary: `${model.routes.length} routes`,
			};
		},
	};
}

function graphqlSection(section: GraphqlGeneration, io: SectionIo, options: SectionOptions): WatchedSection {
	const target = resolve(io.cwd, section.output ?? DEFAULT_OUTPUT.graphql);
	return {
		name: "graphql",
		source: { kind: "poll", url: section.url },
		produce: async () => {
			const token = section.token ?? io.env["STRAPI_TOKEN"];
			const schema = await loadGraphqlSchema({
				url: section.url,
				...(present(token) && { token }),
				...(options.fetch !== undefined && { fetch: options.fetch }),
			});
			const model = graphqlModel(schema);
			return { target, output: emitGraphql(model, { source: `graphql ${section.url}` }), summary: `${model.types.length} types` };
		},
	};
}

/** Every section a config declares, in the order they run. */
export function sectionsOf(config: GenerateConfig, io: SectionIo, options: SectionOptions = {}): WatchedSection[] {
	return [
		...(config.types !== undefined ? [typesSection(config.types, io, options)] : []),
		...(config.routes !== undefined ? [routesSection(config.routes, io, options)] : []),
		...(config.graphql !== undefined ? [graphqlSection(config.graphql, io, options)] : []),
	];
}

/**
 * A fetch that gives up after `ms`, so a hung instance shows up as a timeout
 * rather than stalling a watcher's polls.
 */
export function timedFetch(ms: number): typeof fetch {
	return (input, init) => globalThis.fetch(input, { ...init, signal: AbortSignal.timeout(ms) });
}
