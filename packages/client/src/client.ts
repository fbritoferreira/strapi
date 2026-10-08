import { CollectionClient } from "./clients/collection";
import { Strapi, type StrapiConfig, type Uid } from "./strapi";
import type { StrapiContentTypes } from "./types";

/** {@link StrapiConfig} plus the collection this client is bound to. */
export interface StrapiClientConfig extends StrapiConfig {
	/**
	 * Plural API id, e.g. "articles" for /api/articles. Restricted to the keys
	 * of {@link StrapiContentTypes} once generated code augments the registry;
	 * for a uid outside it, use `new Strapi(config).collection<T>(uid)`.
	 */
	uid: Uid<StrapiContentTypes>;
}

/**
 * Shorthand for `new Strapi(config).collection<T>(uid)`.
 *
 * @example
 * ```ts
 * const articles = new StrapiClient<Article>({ baseURL: "http://localhost:1337", defaultLocale: "en", uid: "articles" });
 * const [err, items] = await articles.findMany();
 * ```
 */
export class StrapiClient<T extends object> extends CollectionClient<T> {
	/** Creates a {@link Strapi} instance from `config` and binds it to `config.uid`. */
	constructor(config: StrapiClientConfig) {
		const { uid, ...rest } = config;
		const strapi = new Strapi(rest);
		super({ http: strapi.http, defaultLocale: strapi.defaultLocale, concurrency: strapi.concurrency }, uid);
	}
}
