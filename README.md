# @fbritoferreira/strapi

[![npm version](https://badge.fury.io/js/%40fbritoferreira%2Fstrapi.svg)](https://badge.fury.io/js/%40fbritoferreira%2Fstrapi)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![npm downloads](https://img.shields.io/npm/dm/@fbritoferreira/strapi.svg)](https://www.npmjs.com/package/@fbritoferreira/strapi)
[![JSR](https://jsr.io/badges/@fbritoferreira/strapi)](https://jsr.io/@fbritoferreira/strapi)
[![JSR Score](https://jsr.io/badges/@fbritoferreira/strapi/score)](https://jsr.io/@fbritoferreira/strapi/score)

A TypeScript client for the Strapi 5 REST API. A root `Strapi` class wraps
collection types, single types, the users-permissions plugin (`/api/users`)
and the upload plugin (`/api/upload`); a `StrapiClient` shorthand covers a
single collection. Every method returns a `[error, data, meta]` tuple instead
of throwing. The `strapi-client generate` CLI command writes TypeScript
interfaces and the content-type registry from your Strapi schema.

## Installation

```sh
npm install @fbritoferreira/strapi
```

```sh
pnpm add @fbritoferreira/strapi
```

```sh
yarn add @fbritoferreira/strapi
```

Requires Node.js >= 20. Ships ESM and CommonJS builds with bundled type
declarations.

### From JSR

The same package is published to [JSR](https://jsr.io/@fbritoferreira/strapi)
as TypeScript source, for Deno, Bun and npm-compatible projects:

```sh
deno add jsr:@fbritoferreira/strapi
```

```sh
npx jsr add @fbritoferreira/strapi
```

```sh
pnpm dlx jsr add @fbritoferreira/strapi
```

```sh
bunx jsr add @fbritoferreira/strapi
```

The JSR package exports the client library only. The `strapi-client` CLI
(see Generating types) is available from npm.

## Quick start

```ts
import { Strapi } from "@fbritoferreira/strapi";

interface Article {
	documentId: string;
	title: string;
	body: string;
}

const strapi = new Strapi({
	baseURL: "http://localhost:1337",
	defaultLocale: "en",
	...(process.env.STRAPI_TOKEN && { token: process.env.STRAPI_TOKEN }),
});

const articles = strapi.collection<Article>("articles");

const [err, items, meta] = await articles.findMany({
	params: { filters: { title: { $contains: "strapi" } }, pagination: { pageSize: 10 } },
});
if (err) throw new Error(`${err.name}: ${err.message}`);
console.log(items.length, "of", meta?.pagination?.total);

const [createErr, created] = await articles.create({ payload: { data: { title: "Hello", body: "..." } } });
const [, updated] = await articles.update({ documentId: created!.documentId, payload: { data: { title: "Hi" } }, params: { status: "published" } });
```

## Clients

`new Strapi(config)` exposes one sub-client per Strapi API surface:

| Client | Access | Methods |
| --- | --- | --- |
| Collection types | `strapi.collection<T>("articles")` | `findMany`, `find`, `findFirst`, `count`, `create`, `update`, `delete`, `upsert` |
| Single types | `strapi.single<T>("homepage")` | `find`, `update`, `delete` |
| Users-permissions | `strapi.users<T>()` | `findMany`, `find`, `me`, `count`, `create`, `update`, `delete` |
| Upload | `strapi.files` | `find`, `findOne`, `upload`, `update`, `delete` |

`collection` and `single` accept a `StrapiContentTypes`/`StrapiSingleTypes`
registry key (see Typed registry below) or any string uid with an explicit
type argument. `users` and `files` work against `/api/users` and
`/api/upload`; they return plain bodies with numeric ids and no locale
handling, matching how those plugins actually respond.

`StrapiClient<T>` is a shorthand for `new Strapi(config).collection<T>(uid)`.
It is a collection client only. It has no `files`, `users()` or `single()`.

```ts
import { StrapiClient } from "@fbritoferreira/strapi";

const articles = new StrapiClient<Article>({
	baseURL: "http://localhost:1337",
	defaultLocale: "en",
	uid: "articles",
});
```

## Query parameters

Pass `params: QueryParams<T>` to filter, sort, select fields, set the
publication status, and paginate.

```ts
const [err, matching, meta] = await articles.findMany({
	params: {
		filters: { title: { $contains: "strapi" } },
		populate: ["category", "author"],
		fields: ["title", "body"],
		sort: ["title:asc"], // keys of T, optionally `:asc`/`:desc`; relation paths like "author.name:asc" are anchored to a key of T
		pagination: { pageSize: 10 },
		status: "published",
	},
});
```

`fields` takes scalar fields; relations, components, media and dynamic zones go
in `populate`. Generated types carry a `__populatable` marker listing which
fields are which, so selecting one with the wrong param is a compile error:

```ts
articles.findMany({ params: { fields: ["cover"] } });    // error: cover is populatable
articles.findMany({ params: { populate: ["title"] } });  // error: title is scalar
```

The marker is type-level only — Strapi never returns it, and it is excluded
from `filters`, `sort` and create/update payloads. Hand-written types without a
marker keep accepting any key in both params.

### The result follows the selection

Params passed inline also narrow what comes back, so the returned type is what
Strapi actually sends:

```ts
const [, articles] = await strapi.collection("articles").findMany({
	params: { fields: ["title", "slug"], populate: ["author"] },
});
// articles: { id: number; documentId: string; title: string; slug: string;
//             author: Author | null }[]

const [, plain] = await strapi.collection("articles").findMany();
plain[0]?.author; // error: nothing populated it, so Strapi does not return it
```

Two rules behind that: Strapi selects `[id, documentId, ...fields]` when
`fields` is given, and returns a populatable field only when `populate` asks
for it — where it then stops being optional. `populate: "*"` populates every
first-level relation, component, media and dynamic zone.

Narrowing needs a generated type (the `__populatable` marker) and params
literal enough to read. Params held in a variable, or a hand-written type, give
the full document back as before:

```ts
const params: ListQueryParams<Article> = { fields: ["title"] };
const [, all] = await articles.findMany({ params }); // Article[], unchanged
```

`pagination` accepts either page-based (`page`, `pageSize`) or offset-based
(`start`, `limit`) options; Strapi picks the mode from whichever fields are
present. `status` is Strapi 5's Draft & Publish filter (`"draft"` or
`"published"`). `_q` runs Strapi's full-text search.

Each method takes only the params its route accepts, mirroring the contracts
Strapi declares for its core routes:

| Method | Params |
| --- | --- |
| `findMany`, `findFirst`, `count` | `ListQueryParams<T>` — the full read surface, including `pagination`, `sort`, `filters` and `_q` |
| `find` | `FindQueryParams<T>` — no `pagination`, no `_q` |
| `create`, `update`, `upsert` | `WriteQueryParams<T>` — `fields` and `populate` only; they shape the response, not which documents are written |
| `SingleTypeClient.find` | `FindQueryParams<T>` |
| `SingleTypeClient.update` | `WriteQueryParams<T>` |

All of them keep the conditional params Strapi adds for localized and
Draft & Publish content types: `locale`, `status`, `publicationFilter` and the
deprecated `hasPublishedVersion`. `publicationFilter` takes one of Strapi's
publication cohorts — `never-published`, `has-published-version`, `modified`,
`unmodified`, `never-published-document`, `has-published-version-document`,
`published-without-draft`, `published-with-draft` — and Strapi answers a 400
for anything else.

## Fetching every page

Pass `all: true` to fetch every page and concatenate the results, instead of
one page at a time.

```ts
const [err, all, meta] = await articles.findMany({
	params: { pagination: { pageSize: 100 } },
	all: true,
});
```

Mode follows the `pagination` you pass: `page`/`pageSize`, or nothing, for
page mode; `start`/`limit` for offset mode. The client fetches the first page
to learn the total, then requests the rest in that same mode:

```ts
const [err, all] = await articles.findMany({
	params: { pagination: { start: 0, limit: 100 } },
	all: true,
});
```

Remaining pages are fetched in parallel, bounded by `concurrency` (default 5).
Set it on the constructor:

```ts
const strapi = new Strapi({ baseURL: "http://localhost:1337", defaultLocale: "en", concurrency: 10 });
```

## i18n

`defaultLocale` is required on both `Strapi` and `StrapiClient`; there is no
implicit `"en"` default, and the constructor throws a `TypeError` if it is
missing or empty.

`create` with `locale` set to a non-default locale searches for the base
document in `defaultLocale` using `filters`, creates it if it does not exist,
then adds the localization. `filters` is how you identify which
default-locale document the new localization belongs to; omitting `filters`
skips that lookup entirely and always creates a fresh default-locale
document before localizing it:

```ts
const [err, frArticle] = await articles.create({
	payload: { data: { title: "Article en français", body: "..." } },
	locale: "fr",
	filters: { title: { $eq: "Existing Title" } },
});
```

`update` and `delete` take `documentId` plus `locale` to target one
localization:

```ts
await articles.update({ documentId: frArticle!.documentId, payload: { data: { title: "Updated" } }, locale: "fr" });

// Deletes only the fr localization; the default-locale document and other
// localizations are untouched.
await articles.delete({ documentId: frArticle!.documentId, locale: "fr" });
```

## Errors

Every method returns `[error, data, meta]`. `data` and `meta` are `null` when
`error` is set.

```ts
export interface ServiceError {
	message: string;
	status?: number;
	name?: string;
	details?: unknown;
	cause?: unknown;
}
```

`name` is Strapi's own error name (`"ValidationError"`, `"NotFoundError"`,
etc.) when Strapi returned one, or one of `"HTTPError"`, `"TimeoutError"`,
`"NetworkError"` for failures the client classifies itself. `details` carries
Strapi's `error.details`, for example per-field validation errors.

```ts
const [err, created] = await articles.create({ payload: { data: { title: "" } } });
if (err) {
	if (err.name === "ValidationError") {
		console.error(err.details); // e.g. { errors: [{ path: ["title"], message: "title must be defined" }] }
	}
	throw new Error(`${err.name}: ${err.message}`);
}
```

## Next.js and custom fetch

Pass `init` on any call to merge extra `RequestInit` fields, including
Next.js's `fetch` extensions, into that request:

```ts
const [err, cached] = await articles.findMany({
	params: { populate: "*" },
	init: { next: { revalidate: 60, tags: ["articles"] } },
});
```

The constructor also accepts `headers`, a custom `fetch` implementation, and
`timeout` (milliseconds, default 10_000):

```ts
const strapi = new Strapi({
	baseURL: "http://localhost:1337",
	defaultLocale: "en",
	headers: { "X-Custom": "1" },
	fetch: myFetch,
	timeout: 5000,
});
```

## Typed registry

Augment `StrapiContentTypes` and `StrapiSingleTypes` so `collection()` and
`single()` infer `T` from the uid, without an explicit type argument:

```ts
declare module "@fbritoferreira/strapi" {
	interface StrapiContentTypes {
		articles: Article;
	}
	interface StrapiSingleTypes {
		homepage: Homepage;
	}
}

strapi.collection("articles"); // CollectionClient<Article>
strapi.single("homepage"); // SingleTypeClient<Homepage>
```

Once the registry is augmented, a uid it does not declare is a compile error,
which catches typos like `strapi.collection("aritcles")`. Both escape hatches
stay open: an explicit type argument overrides the registry and accepts any
uid (`strapi.collection<Article>("custom-route")`), and adding the uid to the
augmentation makes it first class. While the registry is empty — no generated
file imported — any uid is accepted and falls back to `CollectionClient<object>`
/ `SingleTypeClient<object>`.

`StrapiClient`'s `uid` is constrained the same way; for a uid outside the
registry use `new Strapi(config).collection<T>(uid)`.

See Generating types below for a command that emits this augmentation from
your Strapi schema.

## Generating types

`strapi-client generate` writes the interfaces and the registry augmentation for you.

```sh
# From a Strapi project checked out next to your app
npx @fbritoferreira/strapi generate --dir ../my-strapi -o src/strapi-types.ts

# From a running instance (admin user credentials, not an API token)
STRAPI_ADMIN_EMAIL=me@example.com STRAPI_ADMIN_PASSWORD=... \
  npx @fbritoferreira/strapi generate --url https://cms.example.com -o src/strapi-types.ts

# In CI: fail when the committed file is stale
npx @fbritoferreira/strapi generate --dir ../my-strapi -o src/strapi-types.ts --check
```

The installed binary is named `strapi-client`, so `npx @fbritoferreira/strapi generate` and `strapi-client generate` from a local install run the same command.

Import the generated file once anywhere in your app (`import "./strapi-types";`) and `strapi.collection("articles")` returns `CollectionClient<Article>`.

What is generated:

- One `interface` per `api::` content type, extending `StrapiDocument`; localized types get a required `locale`.
- One `interface` per component, with `id: number`.
- Relations, media, components and dynamic zones are optional fields (they appear only when populated). `media` is `StrapiMedia | null` or `StrapiMedia[]`; relations to `plugin::users-permissions.user` are `StrapiUser`.
- Dynamic zones are `Array<(BlocksHero & { __component: "blocks.hero" }) | ...>`.
- `enumeration` becomes a union of string literals; `json` is `unknown`; `biginteger` is `string`.
- `private` attributes are skipped. Plugin content types are skipped unless `--include-plugins` is passed.
- `--include-plugins` registers plugin content types under their `pluralName` even when the plugin does not expose a matching `/api/<pluralName>` route.

The `--url` source calls `POST /admin/login` and the Content-Type Builder routes, which require an admin user with the `plugin::content-type-builder.read` permission. Strapi does not accept API tokens on admin routes.

## Route types from OpenAPI

Content-type schemas describe documents, not routes. For custom routes and the
plugin endpoints (`/auth/local`, `/users`, `/upload/files`), generate a
`StrapiRoutes` registry from an OpenAPI document instead:

```sh
# Strapi 5 writes one with its own CLI (experimental)
cd ../my-strapi && npx strapi openapi generate --output ../my-app/spec.json

# then, in your app
npx @fbritoferreira/strapi generate --openapi spec.json -o src/strapi-routes.ts

# a URL works too, e.g. the documentation plugin's spec
npx @fbritoferreira/strapi generate \
  --openapi https://cms.example.com/documentation/v1.0.0/full_documentation.json
```

The output augments `StrapiRoutes` with one entry per route, keyed
`"<METHOD> <path>"`, and `strapi.route()` calls them:

```ts
import "./strapi-routes";

const [err, session] = await strapi.route("POST /auth/local", {
	body: { identifier: "me@example.com", password: "…" },
});
const [, file] = await strapi.route("GET /upload/files/{id}", { params: { id: 7 } });
```

Path params are substituted into the path, `query` is serialized like collection
params, and the body is returned exactly as Strapi sends it — these routes have
no `data`/`meta` envelope, so `route()` does not unwrap one.

**Use OpenAPI for routes, not for documents.** Strapi's generated spec is lossier
than its schemas: a dynamic zone arrives as `{"type":"array","items":{}}` with the
component union gone, responses carry no `meta`, and `documentId` is described as
a UUID. Keep generating document types from `--dir` or `--url`; the two outputs
are separate files and work side by side.

Routes whose path is a raw regex (Strapi emits `/connect/(.*)` for provider
callbacks) are skipped: they cannot be called by name.

## GraphQL

Strapi serves GraphQL at `/graphql` — at the origin, not under `/api` — when
`@strapi/plugin-graphql` is installed. `strapi.graphql()` runs one operation
there, with the same bearer token and `[error, data]` tuple as the REST clients:

```ts
const [err, data] = await strapi.graphql<{ articles: Article[] }>(
	`query Articles($locale: I18NLocaleCode) {
		articles(locale: $locale) { documentId title }
	}`,
	{ variables: { locale: "fr" } }
);
```

GraphQL errors come back as the error tuple, with the whole `errors` array in
`details` and the single error's `extensions.code` as `name`. A 404 — the plugin
is not installed — is reported as such. Pass `graphqlEndpoint` to `new Strapi()`
when the plugin's `endpoint` option is configured; `strapi.graphqlUrl` shows the
resolved URL.

### Typed documents

`graphql()` also takes a document that carries its own types — a
`TypedDocumentNode`, or the `TypedDocumentString` graphql-codegen emits with
`documentMode: "string"`. Both type arguments are then inferred, `variables` is
required exactly when the document declares a required one, and the selection
set itself is typed, which a raw string cannot be:

```ts
import { ArticlesDocument } from "./gql/graphql";

const [err, data] = await strapi.graphql(ArticlesDocument, { variables: { locale: "fr" } });
// data: { articles: { documentId: string; title: string }[] }
```

Point [graphql-codegen](https://the-guild.dev/graphql/codegen) at your Strapi
instance to produce those documents:

```ts
// codegen.ts
import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
	schema: "http://localhost:1337/graphql",
	documents: ["src/**/*.{ts,tsx}"],
	generates: {
		"./src/gql/": { preset: "client", config: { documentMode: "string" } },
	},
};

export default config;
```

`documentMode: "string"` keeps the query as text, so nothing has to parse an AST
at runtime. The default AST form works too — its source text is read from
`loc`. A document with neither (an AST built without location info) comes back
as an error tuple naming the fix rather than sending an empty query.

No dependency is added for this: `TypedDocument<TData, TVariables>` matches the
`__apiType` marker both forms carry.

To type the operations without codegen, generate the schema:

```sh
npx @fbritoferreira/strapi generate --graphql http://localhost:1337/graphql -o src/strapi-graphql.ts
```

That introspects the endpoint and writes one exported type per object,
interface, enum, input object and union — so query results and variables can be
annotated with the schema's own names:

```ts
import type { Article, ArticleFiltersInput } from "./strapi-graphql";

const [err, data] = await strapi.graphql<{ articles: Article[] }, { filters: ArticleFiltersInput }>(
	"query Articles($filters: ArticleFiltersInput) { articles(filters: $filters) { documentId title } }",
	{ variables: { filters: { title: { eq: "Hello" } } } }
);
```

Those types describe the schema, not a selection: the generated `Article` has
every field, not the ones a given query selected. Typed documents above cover
that case. Introspection has to be reachable — Apollo
disables it when `NODE_ENV=production`, so generate against a development
instance.

## Migrating from 0.4

- `id: number` addressing is gone. `find`, `update` and `delete` now take
  `documentId: string`; Strapi 5 routes accept `documentId` only.
- `find` with no id (the old "find all" call) is removed. Use `findFirst`.
- Every method now returns `[error, data, meta]` instead of `[error, data]`.
  `meta.pagination` carries `total` and `pageCount`. Existing two-element
  destructuring (`const [err, data] = ...`) still works; the third element is
  ignored.
- `T` no longer has to declare `id`.
- `ServiceError` gained `name`, `details` and `cause`. Strapi's `error` body,
  validation details included, is copied into it.
- `defaultLocale` is now required. There is no `"en"` default.
- `StrapiClient` stays as a shorthand for a single collection and now takes
  `defaultLocale`, but it is collection-only: it has no `files`, `users()` or
  `single()`. Use `new Strapi(...)` when you need those.

## Development

1. Clone and install: `git clone <repo> && pnpm install` (Node.js 24, see `.nvmrc`)
2. Run tests: `pnpm test` (Vitest), `pnpm test:coverage` for coverage
3. Lint and typecheck: `pnpm lint && pnpm typecheck`
4. Build: `pnpm build` (outputs ESM, CJS and bundled `.d.ts` to `dist/`; also builds the `generate` CLI to `dist/cli.mjs`, used by `bin/strapi-client.mjs`)
5. Add a changeset for user-facing changes: `pnpm changeset`
6. After changing `src/cli/emit.ts`, refresh the fixture snapshot: `UPDATE_SNAPSHOT=1 pnpm vitest run src/test/cli/emit.spec.ts`
7. Check the JSR publish (slow types, included files): `pnpm jsr:check`

Uses Vite for building and Vitest for testing. Releases are cut by the
`Release` GitHub workflow from `main` via Changesets: it publishes to npm
(Trusted Publishing), creates the GitHub release, then publishes the same
version to JSR from source (`jsr.json`, OIDC provenance). The workflow keeps
`jsr.json`'s version in sync with `package.json`; do not bump it by hand.

## License

Distributed under the MIT License. See `LICENCE.md` for more information.
