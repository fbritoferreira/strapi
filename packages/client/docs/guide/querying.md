# Querying

Pass `params` to filter, sort, select fields, set publication status, and paginate.

```ts
const [err, matching, meta] = await articles.findMany({
	params: {
		filters: { title: { $contains: "strapi" } },
		populate: ["category", "author"],
		fields: ["title", "body"],
		sort: ["title:asc"],
		pagination: { pageSize: 10 },
		status: "published",
		_q: "strapi",
	},
});
```

`sort` values are keys of the document, optionally `:asc` or `:desc`. A relation path such as `"author.name:asc"` has to start with a key of the document. `_q` is Strapi's full-text search. `status` is Draft & Publish: `"draft"` or `"published"`. The server defaults to `published` when you omit it.

`locale` on `params` is omitted from the query string when it equals `defaultLocale`. A `locale` option on the call overrides `params.locale`.

## Which params each method accepts

The sets mirror the contracts Strapi declares for its core routes, so a param the endpoint ignores, or rejects under `api.rest.strictParams`, cannot be passed.

| Method | Params |
| --- | --- |
| `findMany`, `findFirst`, `count` | `fields`, `filters`, `sort`, `populate`, `pagination`, `_q`, plus the conditional params below |
| `find` | `fields`, `filters`, `sort`, `populate`, plus conditional params. No `pagination`, no `_q`. |
| `create`, `update`, `upsert` | `fields`, `populate`, plus conditional params. They shape the response, not which documents are written. |
| `delete` | `fields`, `populate`, `filters`, plus conditional params. |
| `single.find` | same as `find` |
| `single.update`, `single.delete` | `fields`, `populate`, plus conditional params |

Conditional params, present when the content type is localized or uses Draft & Publish: `locale`, `status`, `publicationFilter`, and the deprecated `hasPublishedVersion` and `publicationState`.

`publicationFilter` is one of `never-published`, `has-published-version`, `modified`, `unmodified`, `never-published-document`, `has-published-version-document`, `published-without-draft`, `published-with-draft`. Strapi answers 400 for anything else. `hasPublishedVersion` and `publicationState` (`"live"` | `"preview"` | `"draft"`) are kept so older call sites still type-check; prefer `publicationFilter` and `status`.

`pagination.pageCount` is ignored by Strapi on requests. `withCount` is passed through.

Users and upload routes take a narrower set. See [Users](./users) and [Uploads](./uploads).

## fields and populate

`fields` takes scalar fields. Relations, components, media and dynamic zones go in `populate`. Generated types carry a `__populatable` marker listing which is which, so the wrong param is a compile error:

```ts
articles.findMany({ params: { fields: ["cover"] } }); // error: cover is populatable
articles.findMany({ params: { populate: ["title"] } }); // error: title is scalar
```

The marker is type-level only. Strapi never returns it, and it is excluded from `filters`, `sort` and write payloads. Hand-written types without a marker accept any key in both params.

## Populating with options

In the object form, each field takes `true`, `"*"`, or the same options a top-level read takes, typed against the document behind it: `fields`, `populate`, `filters`, `sort` and `count`. A dynamic zone takes `on`, keyed by component name:

```ts
articles.findMany({
	params: {
		populate: {
			author: { fields: ["name"], populate: { avatar: { fields: ["url"] } } },
			categories: { filters: { slug: { $ne: "hidden" } }, sort: ["name:asc"] },
			comments: { count: true },
			blocks: { on: { "blocks.hero": { populate: ["image"] }, "blocks.quote": true } },
		},
	},
});
```

`count: true` makes the field `{ count: number }` instead of the documents.

## Filters

A bare value is `$eq`. Operators:

| Operator | Meaning |
| --- | --- |
| `$eq` / `$eqi` | Equal, case-sensitive / insensitive |
| `$ne` / `$nei` | Not equal |
| `$lt` / `$lte` / `$gt` / `$gte` | Ordering |
| `$in` / `$notIn` | Membership. Value is an array. |
| `$contains` / `$notContains` | Substring |
| `$containsi` / `$notContainsi` | Substring, case-insensitive |
| `$startsWith` / `$startsWithi` / `$endsWith` / `$endsWithi` | Prefix and suffix |
| `$between` | Range. Value is a pair. |
| `$null` / `$notNull` | Presence. Value is a boolean, not a field value. |
| `$and` / `$or` / `$not` | Combinators, at every depth |

A relation or component filters on the related document's fields, with the same operators at every depth, `id` and `documentId` included:

```ts
articles.findMany({
	params: {
		filters: {
			author: { documentId: { $eq: "abc" } },
			createdBy: { id: { $in: [1, 2] } },
			categories: { parent: { slug: { $eq: "news" } } },
			$or: [{ views: { $null: true } }, { author: { name: { $startsWith: "A" } } }],
		},
	},
});
```

## The result follows the selection

Params passed inline narrow what comes back:

```ts
const [, rows] = await strapi.collection("articles").findMany({
	params: { fields: ["title", "slug"], populate: ["author"] },
});
// { id, documentId, title, slug, author }[]

const [, plain] = await strapi.collection("articles").findMany();
plain[0]?.author; // error: nothing populated it
```

Strapi selects `[id, documentId, ...fields]` when `fields` is given, and returns a populatable field only when `populate` asks for it, where it then stops being optional. `populate: "*"` populates every first-level relation, component, media and dynamic zone.

The same rules apply inside a populate map, at every depth. `populate: { author: { fields: ["name"] } }` gives `author: { id, documentId, name } | null`. A to-many relation is narrowed element by element. `true`, `"*"` and dynamic zones leave the related document whole.

Narrowing needs a generated type (the `__populatable` marker) and params literal enough to read. Params held in a variable, or a hand-written type, give the full document back:

```ts
const params: ListQueryParams<Article> = { fields: ["title"] };
const [, all] = await articles.findMany({ params }); // Article[], unchanged
```

Query strings are serialized with `qs` in bracket/index array format (`filters[title][$contains]=strapi`).
