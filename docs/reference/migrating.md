# Migrating from 0.4

- `id: number` addressing is gone. `find`, `update` and `delete` take `documentId: string`. Strapi 5 routes accept `documentId` only. Users and uploads still use numeric `id`, because those plugins do.
- `find` with no id (the old "find all" call) is removed. Use `findFirst`.
- Every method returns `[error, data, meta]` instead of `[error, data]`. `meta.pagination` carries `total` and `pageCount`. Existing two-element destructuring still works.
- `T` no longer has to declare `id`.
- `ServiceError` gained `name`, `details` and `cause`. Strapi's `error` body, validation details included, is copied into it.
- `defaultLocale` is required. There is no `"en"` default.
- `StrapiClient` stays as a shorthand for a single collection and now takes `defaultLocale`, but it is collection-only: it has no `files`, `users()`, `single()`, `auth`, `route()` or `graphql()`. Use `new Strapi(...)` when you need those.
