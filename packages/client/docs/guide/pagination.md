# Pagination

`pagination` is either page-based (`page`, `pageSize`) or offset-based (`start`, `limit`). Strapi picks the mode from whichever fields are present. `pageCount` on a request is ignored. `withCount: false` is passed through when you do not need the total.

The third tuple element is `meta`, or `null` when the endpoint returns none. `meta.pagination` is one of:

```ts
{ page: number; pageSize: number; pageCount: number; total: number }
{ start: number; limit: number; total: number }
```

## Every page in memory

`all: true` fetches every page and concatenates the results. The client requests the first page to learn the total, then the rest in the same mode, up to `concurrency` at a time (default 5, set on the constructor).

```ts
const [err, all, meta] = await articles.findMany({
	params: { pagination: { pageSize: 100 } },
	all: true,
});

const [offsetErr, offsetAll] = await articles.findMany({
	params: { pagination: { start: 0, limit: 100 } },
	all: true,
});
```

This is the right tool for hundreds of documents and the wrong one for hundreds of thousands.

## One page at a time

`pages()` yields each page as it arrives and only asks for the next when you do. Each iteration is the same `[error, data, meta]` tuple. Breaking out of the loop stops the requests.

```ts
for await (const [err, batch, meta] of articles.pages({
	params: { pagination: { pageSize: 100 } },
})) {
	if (err) throw new Error(err.message);
	await writeRows(batch);
}
```

An error ends the walk, because there is no cursor to continue from. An empty page ends it too, so a stale `total` cannot spin forever. Both pagination modes work. If the server answers an offset request with page-shaped meta, the next request stays in the mode you asked for.

`pages()` does not take `all`. Selection narrowing applies to each page the same way it does on `findMany`.
