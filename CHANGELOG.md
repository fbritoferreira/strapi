# @fbritoferreira/strapi

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
