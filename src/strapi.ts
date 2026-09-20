import { CollectionClient, type ClientContext } from "./clients/collection";
import { FilesClient } from "./clients/files";
import { SingleTypeClient } from "./clients/single";
import { UsersClient } from "./clients/users";
import { HttpClient, type HttpConfig } from "./http";
import type { StrapiContentTypes, StrapiSingleTypes, StrapiUser } from "./types";

export interface StrapiConfig extends HttpConfig {
	/** Locale Strapi treats as default. Requests for this locale omit `?locale=`. */
	defaultLocale: string;
	/** Max parallel requests when `all: true`. Default 5. */
	concurrency?: number;
}

/** Keys of a registry interface, minus the brand marker. */
export type RegistryKey<R> = Exclude<keyof R, "__brand">;

const DEFAULT_CONCURRENCY = 5;

export class Strapi {
	readonly http: HttpClient;
	readonly defaultLocale: string;
	readonly concurrency: number;
	readonly files: FilesClient;

	constructor(config: StrapiConfig) {
		if (typeof config.defaultLocale !== "string" || config.defaultLocale.trim() === "") {
			throw new TypeError('Strapi: defaultLocale is required (e.g. "en")');
		}
		this.http = new HttpClient(config);
		this.defaultLocale = config.defaultLocale;
		this.concurrency = config.concurrency ?? DEFAULT_CONCURRENCY;
		this.files = new FilesClient(this.context());
	}

	collection<K extends RegistryKey<StrapiContentTypes>>(uid: K): CollectionClient<Extract<StrapiContentTypes[K], object>>;
	collection<T extends object = object>(uid: string): CollectionClient<T>;
	collection(uid: string): CollectionClient<object> {
		return new CollectionClient<object>(this.context(), uid);
	}

	single<K extends RegistryKey<StrapiSingleTypes>>(uid: K): SingleTypeClient<Extract<StrapiSingleTypes[K], object>>;
	single<T extends object = object>(uid: string): SingleTypeClient<T>;
	single(uid: string): SingleTypeClient<object> {
		return new SingleTypeClient<object>(this.context(), uid);
	}

	users<T extends object = StrapiUser>(): UsersClient<T> {
		return new UsersClient<T>(this.context());
	}

	protected context(): ClientContext {
		return { http: this.http, defaultLocale: this.defaultLocale, concurrency: this.concurrency };
	}
}
