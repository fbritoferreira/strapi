---
"@fbritoferreira/strapi": minor
---

Rework for Strapi 5. Breaking changes:

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
