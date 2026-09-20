# @fbritoferreira/strapi

[![npm version](https://badge.fury.io/js/%40fbritoferreira%2Fstrapi.svg)](https://badge.fury.io/js/%40fbritoferreira%2Fstrapi)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![npm downloads](https://img.shields.io/npm/dm/@fbritoferreira/strapi.svg)](https://www.npmjs.com/package/@fbritoferreira/strapi)

A TypeScript client for the Strapi 5 REST API. A root `Strapi` class wraps
collection types, single types, the users-permissions plugin (`/api/users`)
and the upload plugin (`/api/upload`); a `StrapiClient` shorthand covers a
single collection. Every method returns a `[error, data, meta]` tuple instead
of throwing.

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
	token: process.env.STRAPI_TOKEN,
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
It is a collection client only, it has no `files`, `users()` or `single()`.

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
		sort: ["title:asc"],
		pagination: { pageSize: 10 },
		status: "published",
	},
});
```

`pagination` accepts either page-based (`page`, `pageSize`) or offset-based
(`start`, `limit`) options; Strapi picks the mode from whichever fields are
present. `status` is Strapi 5's Draft & Publish filter (`"draft"` or
`"published"`).

## Fetching every page

Pass `all: true` to fetch every page and concatenate the results, instead of
one page at a time.

```ts
const [err, all, meta] = await articles.findMany({
	params: { pagination: { pageSize: 100 } },
	all: true,
});
```

The first request tells the client whether Strapi is paging by `page` or by
offset (`start`/`limit`); the remaining pages are then fetched in that same
mode. Pass `pagination: { start, limit }` up front to force offset mode from
the first request:

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
then adds the localization:

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
`timeout` (milliseconds, default 10 000):

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

An explicit type argument still overrides the registry, and an unregistered
uid falls back to `CollectionClient<object>` / `SingleTypeClient<object>`. A
`generate` command planned for 0.7.0 will emit this augmentation from your
Strapi schema.

## Migrating from 0.4

- `id: number` addressing is gone. `find`, `update` and `delete` now take
  `documentId: string`; Strapi 5 routes accept `documentId` only.
- `find` with no id (the old "find all" call) is removed. Use `findFirst`.
- Every method now returns `[error, data, meta]` instead of `[error, data]`.
  `meta.pagination` carries `total` and `pageCount`. Existing two-element
  destructuring (`const [err, data] = ...`) still works; the third element is
  simply ignored.
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
4. Build: `pnpm build` (outputs ESM, CJS and bundled `.d.ts` to `dist/`)
5. Add a changeset for user-facing changes: `pnpm changeset`

Uses Vite for building and Vitest for testing. Releases are cut by the
`Release` GitHub workflow from `main` via Changesets.

## License

Distributed under the MIT License. See `LICENCE.md` for more information.
