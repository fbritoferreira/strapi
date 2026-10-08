# Collections

`strapi.collection("articles")` is a client for `/api/<uid>`. Pass a key of the generated `StrapiContentTypes` registry and the document type is inferred. A uid outside the registry needs an explicit type argument, and is a compile error once the registry is non-empty.

```ts
const articles = strapi.collection("articles");
const custom = strapi.collection<Article>("custom-route");
```

Every method returns `[error, data, meta]`. `data` and `meta` are `null` when `error` is set. Nothing throws for HTTP or network failures.

| Method | Route | Notes |
| --- | --- | --- |
| `findMany` | `GET /api/<uid>` | One page, or every page with `all: true`. |
| `pages` | `GET /api/<uid>` | Async generator. One page per iteration. |
| `find` | `GET /api/<uid>/<documentId>` | `NotFoundError` when the document is missing. |
| `findFirst` | `GET /api/<uid>` | First match, or `null`. Forces a page size of 1. |
| `count` | `GET /api/<uid>` | `meta.pagination.total`, via a one-row request. |
| `create` | `POST /api/<uid>` | Non-default locales are added onto a default-locale document. See [i18n](./i18n). |
| `update` | `PUT /api/<uid>/<documentId>` | |
| `publish` | `PUT /api/<uid>/<documentId>` | `{ data: {} }` and `status=published`. Publishes the draft without changing it. Omitting `data` is a 400. |
| `delete` | `DELETE /api/<uid>/<documentId>` | The deleted document, or `null` when Strapi sends an empty body. `locale` deletes only that localization. |
| `upsert` | find, then `PUT` or `POST` | Updates the first document matching `filters`, or creates one. |

`delete` is a read as much as a write: Strapi's route can return the deleted document, shaped by `fields`, `populate` and `filters`.

## find, findFirst and count

`find` addresses one document by `documentId`. `findFirst` lists with a forced size of 1 and returns `data[0] ?? null`. If you passed offset pagination (`start` or `limit`), it keeps that mode and sets `limit: 1`; otherwise it sets `pageSize: 1`.

`count` does the same one-row read and returns `meta.pagination.total`. When the response has no pagination meta, it falls back to the length of the page it received.

```ts
const [err, article] = await articles.find({ documentId });
const [firstErr, first] = await articles.findFirst({
	params: { filters: { slug: { $eq: slug } }, sort: ["publishedAt:desc"] },
});
const [countErr, total] = await articles.count({ params: { filters: { title: { $contains: "strapi" } } } });
```

## upsert

`upsert` calls `findFirst` with your `filters` (and `params`), then `update`s that document or `create`s one. Without `filters`, `findFirst` matches the first document in the collection, so an unfiltered upsert updates whatever Strapi returns first. Pass a filter that identifies the document.

```ts
const [err, article] = await articles.upsert({
	payload: { data: { slug, title, body: "…" } },
	filters: { slug: { $eq: slug } },
	params: { status: "published" },
});
```

Params on reads and writes are not the same set. See [Querying](./querying).
