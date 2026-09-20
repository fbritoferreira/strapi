# @fbritoferreira/strapi

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
