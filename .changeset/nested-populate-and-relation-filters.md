---
"@fbritoferreira/strapi": minor
---

Nested populate options, operators in relation filters, a wider `qs` range and
a reproducible codegen header.

Object-form `populate` now takes, per field, the options Strapi 5 reads there:
`fields`, `populate`, `filters`, `sort` and `count`, typed against the related
document. Dynamic zones take `on`, keyed by component name. The result follows
the nested options by the same rule as the top level:

```ts
const [, rows] = await articles.findMany({
	params: {
		populate: {
			author: { fields: ["name"] },
			comments: { count: true },
			blocks: { on: { "blocks.hero": { populate: ["image"] } } },
		},
	},
});
// rows[0].author: { id: number; documentId: string; name: string } | null
// rows[0].comments: { count: number }
```

Relation filters accept operators at every depth. An optional, nullable or
to-many relation used to fall through to the document type itself, so
`{ author: { id: { $eq: 1 } } }` and `{ categories: { parent: { slug: { $eq: "a" } } } }`
were type errors; they now take the same operators and `$and`/`$or`/`$not` as
the top level, `id` and `documentId` included. `$null` and `$notNull` take a
boolean, and the `__relations` marker is no longer offered as a filter key.

`qs` is now `^6.14.0` rather than `^6.16.0`. Only `qs.stringify` is used, and
6.14.0 passes the test suite; the previous floor was too recent to install under
a minimum-release-age policy.

`strapi-client generate` no longer writes a timestamp into the header, and
records `--dir`, a config's `dir` and a local `--openapi` file relative to the
output file's directory instead of as an absolute path. The header is now the
same on every machine and across regenerations. `--check` still ignores the
header line, so files written by earlier versions stay up to date.
