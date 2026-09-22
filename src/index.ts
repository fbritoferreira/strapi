/**
 * TypeScript client for the Strapi 5 REST and GraphQL APIs.
 *
 * {@link Strapi} is the root: it wraps collection types, single types, the
 * users-permissions auth and user routes, the upload plugin, generated routes
 * and GraphQL behind one shared HTTP layer. {@link StrapiClient} is a shorthand
 * bound to a single collection. Every method returns a `[error, data, meta]`
 * {@link Result} tuple and never throws for HTTP or network failures.
 *
 * Types come from your own schema: `strapi-client generate` writes the
 * interfaces and augments {@link StrapiContentTypes}, {@link StrapiSingleTypes}
 * and {@link StrapiRoutes}, after which uids, query params and results are all
 * checked against the real content types.
 *
 * @example Reading a collection
 * ```ts
 * import { Strapi } from "@fbritoferreira/strapi";
 *
 * interface Article {
 *   documentId: string;
 *   title: string;
 * }
 *
 * const strapi = new Strapi({ baseURL: "http://localhost:1337", defaultLocale: "en" });
 * const [err, articles, meta] = await strapi
 *   .collection<Article>("articles")
 *   .findMany({ params: { filters: { title: { $contains: "strapi" } } } });
 *
 * if (err) throw new Error(`${err.name}: ${err.message}`);
 * console.log(articles.length, "of", meta?.pagination?.total);
 * ```
 *
 * @example The result follows the params
 * ```ts
 * // With generated types, a selection narrows what comes back.
 * const [, rows] = await strapi.collection("articles").findMany({
 *   params: { fields: ["title", "slug"], populate: ["author"] },
 * });
 * // rows: { id: number; documentId: string; title: string; slug: string; author: Author | null }[]
 * ```
 *
 * @example Signing in
 * ```ts
 * const [err, session] = await strapi.auth.login({ identifier: "me@example.com", password: "…" });
 * if (err) throw new Error(err.message);
 * strapi.setToken(session.jwt);
 * ```
 *
 * @example Custom routes and GraphQL
 * ```ts
 * // Generated from an OpenAPI document with `strapi-client generate --openapi`.
 * const [, file] = await strapi.route("GET /upload/files/{id}", { params: { id: 7 } });
 *
 * // A graphql-codegen document types both its variables and its result.
 * const [, data] = await strapi.graphql(ArticlesDocument, { variables: { locale: "fr" } });
 * ```
 *
 * @module
 */

export * from "./types";
export type { ServiceError, Result } from "./errors";
export { HttpClient, type HttpConfig } from "./http";
export { Strapi, type StrapiConfig, type RegistryKey, type Uid, type DocOf } from "./strapi";
export { StrapiClient, type StrapiClientConfig } from "./client";
export { CollectionClient, type ClientContext } from "./clients/collection";
export { SingleTypeClient } from "./clients/single";
export { AuthClient } from "./clients/auth";
export { UsersClient } from "./clients/users";
export { FilesClient, type FileInfo, type UploadOptions } from "./clients/files";
