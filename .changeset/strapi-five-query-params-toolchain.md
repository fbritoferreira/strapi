---
"@fbritoferreira/strapi": minor
---

- Add Strapi 5 query parameters to `QueryParams`: `status` (`"draft" | "published"`), `publicationFilter`, and offset pagination via `pagination.start` / `pagination.limit`. `publicationState` (Strapi 4) and `pagination.pageCount` are kept but marked deprecated.
- Ship ESM as `dist/strapi.mjs` and CommonJS as `dist/strapi.cjs` with matching `.d.mts` / `.d.cts` declarations, so Node no longer warns about module type detection when importing the ESM build. Deep imports of the old `dist/strapi.es.js` / `dist/strapi.cjs.js` paths are no longer available; use the package entry point.
- Declare `engines.node >= 20` (the client relies on the global Fetch API) and publish only `dist`, `README.md`, `LICENCE.md` and `CHANGELOG.md` via the `files` field.
- Upgrade toolchain: TypeScript 6, ESLint 10, Vite 8, Vitest 5, Changesets 3, pnpm 12.
