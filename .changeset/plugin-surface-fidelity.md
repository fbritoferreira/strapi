---
"@fbritoferreira/strapi": minor
---

Match the plugin clients to their actual routes.

`/api/users` and `/api/upload` are not content-API routes, so they never
accepted `status`, `locale` or `_q`. Their params are now the sets Strapi
declares: `PluginListQueryParams` (`fields`, `populate`, `sort`, `pagination`,
`filters`) for `users().findMany` and `files.find`, `PluginFindQueryParams`
(`fields`, `populate`) for `users().find`, `users().me` and `files.findOne`, and
`filters` alone for `users().count`. `files.findOne` now sends those params,
which it previously ignored.

`StrapiUser` gains `role`, typed as the role id or a `StrapiRole` when
populated. `StrapiMedia` gains `focalPoint` and `related`, both of which the
upload plugin returns.

`delete` takes the params its route declares — `fields`, `populate` and
`filters` on a collection, `fields` and `populate` on a single type — and
returns the deleted document, narrowed by those params, or `null` when Strapi
answers with an empty body. It previously returned `null` unconditionally and
`DeleteQueryParams` was exported but unused.
