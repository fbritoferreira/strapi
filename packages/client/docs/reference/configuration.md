# Configuration

Constructor options live on [Configuration](../guide/configuration). This page is the option list in one place, including codegen.

## `Strapi`

| Option | Required | Default |
| --- | --- | --- |
| `baseURL` | yes | Origin. `/api` is appended when missing. |
| `defaultLocale` | yes | Omitted from query strings. |
| `token` | no | Bearer token. |
| `headers` | no | Merged into every request. |
| `fetch` | no | `globalThis.fetch` |
| `timeout` | no | `10000` ms, per attempt |
| `retry` | no | Off. A number is `attempts`. |
| `refreshOnUnauthorized` | no | Off. `{ token?, cookie?, onRefresh? }` |
| `concurrency` | no | `5` |
| `graphqlEndpoint` | no | `"/graphql"`, resolved against the origin |
| `graphqlArgs` | no | Required by `query()` and `mutate()` |

`StrapiClient` takes the same options plus `uid`.

## `generateConfig`

```ts
import { generateConfig } from "@fbritoferreira/strapi";

export default generateConfig({
	types: {
		dir: "../my-strapi", // or url, never both
		includePlugins: false,
		email: process.env.STRAPI_ADMIN_EMAIL, // url only
		password: process.env.STRAPI_ADMIN_PASSWORD,
		output: "src/strapi-types.ts",
	},
	routes: {
		openapi: "./spec.json",
		token: process.env.STRAPI_TOKEN,
		password: process.env.STRAPI_DOCS_PASSWORD,
		output: "src/strapi-routes.ts",
	},
	graphql: {
		url: "http://localhost:1337/graphql",
		token: process.env.STRAPI_TOKEN,
		output: "src/strapi-graphql.ts",
	},
	watch: { interval: 2000 },
});
```

Every section is optional. See [One config file](../codegen/config) and the [CLI](./cli).
