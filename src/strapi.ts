import { CollectionClient, type ClientContext } from "./clients/collection";
import { FilesClient } from "./clients/files";
import { SingleTypeClient } from "./clients/single";
import { UsersClient } from "./clients/users";
import { HttpClient, type HttpConfig } from "./http";
import type { StrapiContentTypes, StrapiSingleTypes, StrapiUser } from "./types";

/** Options for the root {@link Strapi} class. */
export interface StrapiConfig extends HttpConfig {
	/** Locale Strapi treats as default. Requests for this locale omit `?locale=`. */
	defaultLocale: string;
	/** Max parallel requests when `all: true`. Default 5. */
	concurrency?: number;
}

/** Keys of a registry interface, minus the brand marker. */
export type RegistryKey<R> = Exclude<keyof R, "__brand">;

const DEFAULT_CONCURRENCY = 5;

/**
 * Root client for a Strapi 5 instance. Hands out typed sub-clients for
 * collection types, single types, users and uploads that all share one
 * {@link HttpClient}.
 *
 * @example
 * ```ts
 * const strapi = new Strapi({ baseURL: "http://localhost:1337", defaultLocale: "en", token: process.env.STRAPI_TOKEN });
 * const [err, articles] = await strapi.collection<Article>("articles").findMany({ params: { pagination: { pageSize: 10 } } });
 * ```
 */
export class Strapi {
	/** Shared HTTP layer. Use it directly for endpoints this client does not wrap. */
	readonly http: HttpClient;
	/** Locale omitted from query strings because Strapi treats it as default. */
	readonly defaultLocale: string;
	/** Max parallel page requests when fetching with `all: true`. */
	readonly concurrency: number;
	/** Upload plugin client (`/api/upload`). */
	readonly files: FilesClient;

	/** @throws {TypeError} when `defaultLocale` or `baseURL` is missing or blank. */
	constructor(config: StrapiConfig) {
		if (typeof config.defaultLocale !== "string" || config.defaultLocale.trim() === "") {
			throw new TypeError('Strapi: defaultLocale is required (e.g. "en")');
		}
		this.http = new HttpClient(config);
		this.defaultLocale = config.defaultLocale;
		this.concurrency = config.concurrency ?? DEFAULT_CONCURRENCY;
		this.files = new FilesClient(this.context());
	}

	/**
	 * Client for a collection type at `/api/<uid>`.
	 *
	 * Pass a key of the augmented {@link StrapiContentTypes} registry to get the
	 * document type inferred, or an explicit type argument otherwise.
	 */
	collection<K extends RegistryKey<StrapiContentTypes>>(uid: K): CollectionClient<Extract<StrapiContentTypes[K], object>>;
	collection<T extends object = object>(uid: string): CollectionClient<T>;
	collection(uid: string): CollectionClient<object> {
		return new CollectionClient<object>(this.context(), uid);
	}

	/**
	 * Client for a single type at `/api/<uid>`.
	 *
	 * Pass a key of the augmented {@link StrapiSingleTypes} registry to get the
	 * document type inferred, or an explicit type argument otherwise.
	 */
	single<K extends RegistryKey<StrapiSingleTypes>>(uid: K): SingleTypeClient<Extract<StrapiSingleTypes[K], object>>;
	single<T extends object = object>(uid: string): SingleTypeClient<T>;
	single(uid: string): SingleTypeClient<object> {
		return new SingleTypeClient<object>(this.context(), uid);
	}

	/** Client for the users-permissions plugin at `/api/users`. */
	users<T extends object = StrapiUser>(): UsersClient<T> {
		return new UsersClient<T>(this.context());
	}

	/** Context handed to every sub-client. */
	protected context(): ClientContext {
		return { http: this.http, defaultLocale: this.defaultLocale, concurrency: this.concurrency };
	}
}
