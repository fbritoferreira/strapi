---
"@fbritoferreira/strapi": minor
---

Type query params per route, and fix `publicationFilter`.

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
