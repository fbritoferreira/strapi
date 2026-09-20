# @fbritoferreira/strapi

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
