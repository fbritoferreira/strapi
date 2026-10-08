# Quick start

```ts
import { Strapi } from "@fbritoferreira/strapi";

interface Article {
	documentId: string;
	title: string;
	body: string;
}

const strapi = new Strapi({
	baseURL: "http://localhost:1337",
	defaultLocale: "en",
	...(process.env.STRAPI_TOKEN && { token: process.env.STRAPI_TOKEN }),
});

const articles = strapi.collection<Article>("articles");

const [err, items, meta] = await articles.findMany({
	params: { filters: { title: { $contains: "strapi" } }, pagination: { pageSize: 10 } },
});
if (err) throw new Error(`${err.name}: ${err.message}`);
console.log(items.length, "of", meta?.pagination?.total);

const [createErr, created] = await articles.create({
	payload: { data: { title: "Hello", body: "..." } },
});
if (createErr) throw new Error(createErr.message);

const [, updated] = await articles.update({
	documentId: created.documentId,
	payload: { data: { title: "Hi" } },
	params: { status: "published" },
});
```

`StrapiClient` is a shorthand for one collection. It has no `files`, `users()`, `single()`, `auth`, `route()` or `graphql()`.

```ts
import { StrapiClient } from "@fbritoferreira/strapi";

const articles = new StrapiClient<Article>({
	baseURL: "http://localhost:1337",
	defaultLocale: "en",
	uid: "articles",
});
```

Once you [generate types](../codegen/content-types), drop the type argument: `strapi.collection("articles")` infers the document.
