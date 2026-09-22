import { CollectionClient, type ClientContext } from "./clients/collection";
import { FilesClient } from "./clients/files";
import { SingleTypeClient } from "./clients/single";
import { UsersClient } from "./clients/users";
import { HttpClient, type HttpConfig } from "./http";
import { fail, ok, type Result } from "./errors";
import { buildRoutePath } from "./route";
import type {
	FetchInit,
	GraphqlResponse,
	RouteArgs,
	StrapiContentTypes,
	StrapiRoutes,
	StrapiSingleTypes,
	StrapiUser,
} from "./types";

/** Options for the root {@link Strapi} class. */
export interface StrapiConfig extends HttpConfig {
	/** Locale Strapi treats as default. Requests for this locale omit `?locale=`. */
	defaultLocale: string;
	/** Max parallel requests when `all: true`. Default 5. */
	concurrency?: number;
	/**
	 * Path of the GraphQL endpoint, resolved against the origin rather than the
	 * API root. Default `/graphql`, matching `@strapi/plugin-graphql`; change it
	 * when the plugin's `endpoint` option is configured.
	 */
	graphqlEndpoint?: string;
}

/** Keys of a registry interface, minus the brand marker. */
export type RegistryKey<R> = Exclude<keyof R, "__brand">;

/**
 * Uid accepted for a registry: any string while the registry is empty, and only
 * its declared keys once generated code augments it. Import the file emitted by
 * `strapi-client generate` to turn a typo in a uid into a compile error.
 */
export type Uid<R> = [RegistryKey<R>] extends [never] ? string : RegistryKey<R> & string;

/** Document type a registry maps `K` to; `object` when `K` is not one of its keys. */
export type DocOf<R, K> = K extends keyof R ? Extract<R[K], object> : object;

/**
 * Makes an overload uncallable unless the caller passes a type argument: with
 * `T` left at `never` the rest parameter is `[never]`, which nothing satisfies.
 */
type RequireTypeArgument<T> = [T] extends [never] ? [never] : [];

const DEFAULT_CONCURRENCY = 5;
const DEFAULT_GRAPHQL_ENDPOINT = "/graphql";

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
	/** Absolute URL of the GraphQL endpoint. */
	readonly graphqlUrl: string;

	/** @throws {TypeError} when `defaultLocale` or `baseURL` is missing or blank. */
	constructor(config: StrapiConfig) {
		if (typeof config.defaultLocale !== "string" || config.defaultLocale.trim() === "") {
			throw new TypeError('Strapi: defaultLocale is required (e.g. "en")');
		}
		this.http = new HttpClient(config);
		this.defaultLocale = config.defaultLocale;
		this.concurrency = config.concurrency ?? DEFAULT_CONCURRENCY;
		this.files = new FilesClient(this.context());
		const origin = this.http.baseURL.replace(/\/api$/, "");
		const endpoint = config.graphqlEndpoint ?? DEFAULT_GRAPHQL_ENDPOINT;
		this.graphqlUrl = `${origin}/${endpoint.replace(/^\/+/, "")}`;
	}

	/**
	 * Client for a collection type at `/api/<uid>`.
	 *
	 * Pass a key of the augmented {@link StrapiContentTypes} registry to get the
	 * document type inferred. A uid outside the registry needs an explicit type
	 * argument: `strapi.collection<Article>("articles")`.
	 */
	collection<K extends Uid<StrapiContentTypes>>(uid: K): CollectionClient<DocOf<StrapiContentTypes, K>>;
	collection<T extends object = never>(uid: string, ...requireTypeArgument: RequireTypeArgument<T>): CollectionClient<T>;
	collection(uid: string): CollectionClient<object> {
		return new CollectionClient<object>(this.context(), uid);
	}

	/**
	 * Client for a single type at `/api/<uid>`.
	 *
	 * Pass a key of the augmented {@link StrapiSingleTypes} registry to get the
	 * document type inferred. A uid outside the registry needs an explicit type
	 * argument: `strapi.single<Homepage>("homepage")`.
	 */
	single<K extends Uid<StrapiSingleTypes>>(uid: K): SingleTypeClient<DocOf<StrapiSingleTypes, K>>;
	single<T extends object = never>(uid: string, ...requireTypeArgument: RequireTypeArgument<T>): SingleTypeClient<T>;
	single(uid: string): SingleTypeClient<object> {
		return new SingleTypeClient<object>(this.context(), uid);
	}

	/**
	 * Calls a route of the generated {@link StrapiRoutes} registry by name.
	 *
	 * Path params are substituted into the path, `query` is serialised the same
	 * way as collection params, and `body` is sent as JSON. The body is returned
	 * as Strapi sends it — these routes have no `data`/`meta` envelope.
	 *
	 * @example
	 * ```ts
	 * const [err, session] = await strapi.route("POST /auth/local", { body: { identifier, password } });
	 * ```
	 */
	async route<K extends RegistryKey<StrapiRoutes>>(
		key: K,
		...options: RouteArgs<StrapiRoutes[K]>
	): Promise<Result<StrapiRoutes[K] extends { response: infer R } ? R | null : null>> {
		const request = buildRoutePath(String(key), options[0] as Record<string, unknown> | undefined);
		const [err, body] = await this.http.request(request.path, request.init);
		if (err) return fail(err);
		return ok(body as StrapiRoutes[K] extends { response: infer R } ? R | null : null);
	}

	/**
	 * Runs one GraphQL operation against {@link graphqlUrl}.
	 *
	 * The endpoint only exists when `@strapi/plugin-graphql` is installed; when
	 * it is not, Strapi answers 404 and this returns that as an error tuple.
	 * GraphQL errors come back as an error tuple too, with the whole `errors`
	 * array in `details`.
	 *
	 * @example
	 * ```ts
	 * const [err, data] = await strapi.graphql<{ articles: Article[] }>(
	 *   "query Articles($locale: I18NLocaleCode) { articles(locale: $locale) { documentId title } }",
	 *   { variables: { locale: "fr" } }
	 * );
	 * ```
	 */
	async graphql<TData = unknown, TVariables extends Record<string, unknown> = Record<string, unknown>>(
		query: string,
		options: { variables?: TVariables; operationName?: string; init?: FetchInit } = {}
	): Promise<Result<TData>> {
		const { variables, operationName, init } = options;
		const [err, body] = await this.http.request<GraphqlResponse<TData>>(this.graphqlUrl, {
			...init,
			method: "POST",
			body: JSON.stringify({
				query,
				...(variables !== undefined && { variables }),
				...(operationName !== undefined && { operationName }),
			}),
		});
		if (err) {
			if (err.status === 404) {
				return fail({
					...err,
					message: `Strapi: no GraphQL endpoint at ${this.graphqlUrl} (is @strapi/plugin-graphql installed?)`,
				});
			}
			return fail(err);
		}
		const errors = body?.errors;
		if (errors !== undefined && errors.length > 0) {
			const name = errors.length === 1 ? (errors[0]?.extensions?.code ?? "GraphQLError") : "GraphQLError";
			return fail({ name, message: errors.map((e) => e.message).join("; "), details: errors });
		}
		if (body?.data === undefined || body.data === null) {
			return fail({ name: "GraphQLError", message: `Strapi: GraphQL response from ${this.graphqlUrl} had no data` });
		}
		return ok(body.data);
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
