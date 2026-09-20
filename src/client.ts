import { CollectionClient } from "./clients/collection";
import { Strapi, type StrapiConfig } from "./strapi";

export interface StrapiClientConfig extends StrapiConfig {
	/** Plural API id, e.g. "articles" for /api/articles. */
	uid: string;
}

/** Shorthand for `new Strapi(config).collection<T>(uid)`. */
export class StrapiClient<T extends object> extends CollectionClient<T> {
	constructor(config: StrapiClientConfig) {
		const { uid, ...rest } = config;
		const strapi = new Strapi(rest);
		super({ http: strapi.http, defaultLocale: strapi.defaultLocale, concurrency: strapi.concurrency }, uid);
	}
}
