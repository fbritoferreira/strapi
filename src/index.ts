/**
 * TypeScript client for the Strapi 5 REST API.
 *
 * {@link Strapi} is the root: it wraps collection types, single types, the
 * users-permissions plugin and the upload plugin behind one shared HTTP layer.
 * {@link StrapiClient} is a shorthand bound to a single collection. Every
 * method returns a `[error, data, meta]` {@link Result} tuple and never throws
 * for HTTP or network failures.
 *
 * @example
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
