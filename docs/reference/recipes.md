# Recipes

These snippets match the ones type-checked in `src/cli/__fixtures__/readme-recipes.ts`.

## Search, then walk every page

```ts
const [err, all] = await articles.findMany({
	params: { _q: term, sort: ["publishedAt:desc"], pagination: { pageSize: 100 } },
	all: true,
});
```

## A list view only needs a few columns

```ts
const [err, rows] = await articles.findMany({
	params: { fields: ["title", "slug"], populate: ["cover"], pagination: { pageSize: 20 } },
});
if (err) throw new Error(err.message);

rows.map((row) => ({ title: row.title, href: `/blog/${row.slug}`, image: row.cover?.url }));
```

## Upsert by slug

```ts
const [err, article] = await articles.upsert({
	payload: { data: { slug, title, body: "…" } },
	filters: { slug: { $eq: slug } },
	params: { status: "published" },
});
```

## Upload a file and attach it

`refId` is forwarded as Strapi's upload route receives it (`string | number`).

```ts
const [err, uploaded] = await strapi.files.upload({
	files: file,
	ref: "api::article.article",
	refId: documentId,
	field: "cover",
});
```

## Sign in, keep the session, refresh it

```ts
const [err, session] = await strapi.auth.login({ identifier, password });
if (err) throw new Error(err.message);
strapi.setToken(session.jwt);

if (session.refreshToken !== undefined) {
	const [refreshErr, refreshed] = await strapi.auth.refresh({ refreshToken: session.refreshToken });
	if (!refreshErr) strapi.setToken(refreshed.jwt);
}
```

## Next.js: cache a read and revalidate it by tag

```ts
const [err, data] = await articles.findMany({
	params: { fields: ["title", "slug"] },
	init: { next: { revalidate: 3600, tags: ["articles"] } },
});
```

## One localization at a time

```ts
await articles.update({ documentId, payload: { data: { title } }, locale: "fr" });
```

## Stream a large collection

```ts
for await (const [err, batch] of articles.pages({ params: { pagination: { pageSize: 100 } } })) {
	if (err) throw new Error(err.message);
	await writeRows(batch);
}
```
