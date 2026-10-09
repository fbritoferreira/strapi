# @fbritoferreira/strapi

A typed TypeScript client for the Strapi 5 REST and GraphQL APIs. Every method returns an `[error, data, meta]` tuple and never throws for HTTP or network failures.

## Install

```sh
npm install @fbritoferreira/strapi
```

Requires Node.js 20.3 or newer. Also published to [JSR](https://jsr.io/@fbritoferreira/strapi) (`deno add jsr:@fbritoferreira/strapi`).

## Quick start

```ts
import { Strapi } from "@fbritoferreira/strapi";

interface Article {
	documentId: string;
	title: string;
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

const [createErr, created] = await articles.create({ payload: { data: { title: "Hello" } } });
if (createErr) throw new Error(createErr.message);
```

Generate types from your schema with `npx @fbritoferreira/strapi generate --dir <strapi-project>`, then drop the type argument: `strapi.collection("articles")` infers the document.

## Documentation

Full guide and reference: https://strapi.fbritoferreira.com/packages/client/

Upgrading from 0.4: see [MIGRATION.md](./MIGRATION.md).

## License

MIT
