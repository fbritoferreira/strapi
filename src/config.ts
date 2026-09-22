/** Options shared by both ways of generating document types. */
interface TypesOptions {
	/** Also emit plugin content types. */
	includePlugins?: boolean;
	/** Output file. Default `strapi-types.ts`. */
	output?: string;
}

/** Document types read from a Strapi checkout. */
export interface TypesFromDir extends TypesOptions {
	/** Strapi project root, read from disk. */
	dir: string;
	url?: never;
}

/** Document types read from a running instance's Content-Type Builder. */
export interface TypesFromUrl extends TypesOptions {
	/** Running instance; needs admin credentials, since the Content-Type Builder is an admin API. */
	url: string;
	dir?: never;
	/** Admin email. Falls back to `STRAPI_ADMIN_EMAIL`. */
	email?: string;
	/** Admin password. Falls back to `STRAPI_ADMIN_PASSWORD`. */
	password?: string;
}

/** How to generate document types: from a checkout, or from a running instance. */
export type TypesGeneration = TypesFromDir | TypesFromUrl;

/** How to generate route types: from an OpenAPI document or a documentation page. */
export interface RoutesGeneration {
	/** File path or URL of the document, or of the documentation plugin's page. */
	openapi: string;
	/** Bearer token for a protected URL. Falls back to `STRAPI_TOKEN`. */
	token?: string;
	/** Password for the documentation plugin's restricted access. Falls back to `STRAPI_DOCS_PASSWORD`. */
	password?: string;
	/** Output file. Default `strapi-routes.ts`. */
	output?: string;
}

/** How to generate GraphQL schema types. */
export interface GraphqlGeneration {
	/** GraphQL endpoint, e.g. `https://cms.example.com/graphql`. */
	url: string;
	/** Bearer token, when introspection is protected. Falls back to `STRAPI_TOKEN`. */
	token?: string;
	/** Output file. Default `strapi-graphql.ts`. */
	output?: string;
}

/**
 * Everything `strapi-client generate --config` should produce. Each section is
 * optional; the ones present run in order and write their own file.
 */
export interface GenerateConfig {
	types?: TypesGeneration;
	routes?: RoutesGeneration;
	graphql?: GraphqlGeneration;
}

/**
 * Identity function that types a config file.
 *
 * @example
 * ```ts
 * // strapi-codegen.config.ts
 * import { generateConfig } from "@fbritoferreira/strapi";
 *
 * export default generateConfig({
 *   types: { url: "https://cms.example.com", password: process.env.STRAPI_ADMIN_PASSWORD },
 *   routes: { openapi: "https://cms.example.com/documentation/v1.0.0" },
 *   graphql: { url: "https://cms.example.com/graphql" },
 * });
 * ```
 */
export function generateConfig(config: GenerateConfig): GenerateConfig {
	return config;
}
