# Migrating from 0.4

`find`, `update` and `delete` take `documentId: string`. Strapi 5 content routes do not accept a numeric `id`. Users and uploads still use a numeric `id`, because those plugins do.

- `find` with no id (the old "find all" call) is removed. Use `findFirst`.
- Every method returns `[error, data, meta]` instead of `[error, data]`. `meta.pagination` carries `total` and `pageCount`. `const [err, data] = ...` still works; the third element is ignored.
- `T` no longer has to declare `id`.
- `ServiceError` gained `name`, `details` and `cause`. Strapi's `error` body, validation details included, is copied into it.
- `defaultLocale` is required. There is no `"en"` default.
- `StrapiClient` stays a shorthand for one collection and now takes `defaultLocale`. It has no `files`, `users()`, `single()`, `auth`, `route()` or `graphql()`. Use `new Strapi(...)` for those.

The same notes are in [MIGRATION.md](https://github.com/fbritoferreira/strapi/blob/main/packages/client/MIGRATION.md), which npm and JSR ship with the package.
