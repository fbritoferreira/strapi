# @fbritoferreira/strapi

## 0.10.0

### Minor Changes

- 177562d: Split `fields` from `populate` in generated types.
  
  `strapi-client generate` now emits a `__populatable` marker on every content
  type and component, listing the fields Strapi populates (relations, components,
  media, dynamic zones). `fields` and `sort` accept only the remaining scalar
  fields; `populate` accepts only the marked ones, as a single field, a list, a
  dotted path or a nested map. Selecting a field with the wrong param is a compile
  error instead of a request Strapi silently ignores.
  
  The marker is type-level only: Strapi never returns it, and it is excluded from
  `filters`, `sort` and create/update payloads. Types written by hand, with no
  marker, keep accepting any key in both params.
  
  `Populate<T>` no longer falls back to `string[]`, so a typo in a populate list
  is caught for hand-written types too. `ScalarKey`, `PopulatableKey`,
  `PopulatePath` and `PopulatableMarker` are exported.

## 0.9.0

### Minor Changes

- d5193ad: Type query params per route, and fix `publicationFilter`.
  
  Each method now takes only the params its Strapi route accepts, mirroring the
  zod contracts Strapi declares for its core content-API routes: `find` no longer
  accepts `pagination` or `_q`, and `create`, `update` and `upsert` accept only
  `fields`, `populate` and the conditional locale / Draft & Publish params. The
  sets are exported as `ListQueryParams`, `FindQueryParams`, `WriteQueryParams`
  and `DeleteQueryParams`.
  
  `publicationFilter` was typed `"all" | "modified" | "published" | "unpublished"`.
  Strapi validates this param against eight publication cohorts and answers a 400
  for anything else, so three of those four values were runtime errors. It is now
  `PublicationFilter`: `never-published`, `has-published-version`, `modified`,
  `unmodified`, `never-published-document`, `has-published-version-document`,
  `published-without-draft`, `published-with-draft`. The deprecated
  `hasPublishedVersion` param Strapi still accepts is typed alongside it.
  
  Adds the `_q` full-text search param, which Strapi's list routes accept and this
  client had no way to express, and exports `Uid` and `DocOf` so wrappers can name
  the registry types.

## 0.8.0

### Minor Changes

- 491e8ec: Constrain collection and single-type uids to the typed registry.
  
  Once `StrapiContentTypes` / `StrapiSingleTypes` are augmented — by the file
  `strapi-client generate` emits, or by hand — `strapi.collection(uid)` and
  `strapi.single(uid)` reject a uid the registry does not declare, so a typo is a
  compile error instead of a silent `CollectionClient<object>`. A uid outside the
  registry now needs an explicit type argument (`strapi.collection<Article>(uid)`).
  `StrapiClientConfig["uid"]` is constrained the same way. Projects that do not
  augment the registry are unaffected: any uid is still accepted.
  
  `SortField<T>` no longer accepts an arbitrary `"anything:asc"` string. Sort
  entries must start with a key of `T`; relation paths such as `"author.name:asc"`
  keep working.

## 0.7.0

### Minor Changes

- f6e4c55: Add the `strapi-client generate` command. It reads Strapi 5 content-type and component schemas from a project directory (`--dir`) or from a running instance's Content-Type Builder admin API (`--url` with admin email and password) and writes a TypeScript file with one interface per type plus the `StrapiContentTypes` / `StrapiSingleTypes` module augmentation, so `strapi.collection("articles")` is typed without a type argument. `--check` exits 1 when the file is out of date, for CI. No new runtime dependencies.

## 0.6.0

### Minor Changes

- 458944a: Rework for Strapi 5. Breaking changes:
  
  - `id` is now `documentId: string` on `find`, `update`, `delete`. Strapi 5 routes accept `documentId` only.
  - `find` without an id is removed. Use `findFirst`.
  - Every method returns `[error, data, meta]`. `meta.pagination` carries `total` and `pageCount`. Two-element destructuring keeps working.
  - `T` no longer has to declare `id`.
  - `ServiceError` gains `name`, `details`, `cause`. Strapi's `error` body (validation details included) is copied into it.
  - `defaultLocale` is required. There is no `"en"` default.
  - New root `Strapi` class with `collection()`, `single()`, `users()`, `files`. `StrapiClient` stays as a shorthand and now takes `defaultLocale`.
  
  New:
  
  - Single types, users-permissions (`/api/users`) and upload plugin (`/api/upload`) clients.
  - `count()`, `findFirst()`.
  - Constructor options `headers`, `fetch`, `timeout` (default 10 s), `concurrency` (default 5 for `all: true`).
  - Per-call `init` (`RequestInit` plus Next.js `next` options) merged into every request.
  - `all: true` supports `pagination.start`/`limit` (offset mode).
  - `params` are sent on `create` and `update`, so `{ status: "published" }` reaches Strapi.
  - `StrapiContentTypes`/`StrapiSingleTypes` registry interfaces for typed `collection("articles")` calls.
  - `create` with a non-default locale and no `filters` now creates a fresh default-locale document instead of localizing the first document Strapi returns.

## 0.5.0

### Minor Changes

- ac7b886: - Add Strapi 5 query parameters to `QueryParams`: `status` (`"draft" | "published"`), `publicationFilter`, and offset pagination via `pagination.start` / `pagination.limit`. `publicationState` (Strapi 4) and `pagination.pageCount` are kept but marked deprecated.
  - Ship ESM as `dist/strapi.mjs` and CommonJS as `dist/strapi.cjs` with matching `.d.mts` / `.d.cts` declarations, so Node no longer warns about module type detection when importing the ESM build. Deep imports of the old `dist/strapi.es.js` / `dist/strapi.cjs.js` paths are no longer available; use the package entry point.
  - Declare `engines.node >= 20` (the client relies on the global Fetch API) and publish only `dist`, `README.md`, `LICENCE.md` and `CHANGELOG.md` via the `files` field.
  - Upgrade toolchain: TypeScript 6, ESLint 10, Vite 8, Vitest 5, Changesets 3, pnpm 12.

## 0.4.0

### Minor Changes

- 05000e1: - Refactor constructor to use a config object `{ baseURL, uid, token? }` instead of positional params.
  - Update `findMany()` to accept options `{ params?, locale?, all? }` and `find()` to include `all` param for consistency.
  - Add pagination support: when `all: true`, methods automatically fetch all pages and merge results.

## 0.3.1

### Patch Changes

- 456d542: - Remove type: module to enable CommonJS support
  - Add exports field for proper dual package resolution
  - Create separate tsconfig.cjs.json for CommonJS builds
  - Update build script to generate both ESM and CJS outputs
  - Configure Vite to target Node.js 14+ for broader compatibility

## 0.3.0

### Minor Changes

- 00a6d56: Update upsert and create endpoints to work with localized content

## 0.2.0

### Minor Changes

- 401ce7d: Initial release

## 0.1.0

### Minor Changes

- 401ce7d: Initial release
