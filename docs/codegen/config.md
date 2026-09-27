# One config file

Three sources means three invocations. `--config` runs them together, from a TypeScript file that type-checks itself:

```ts
// strapi-codegen.config.ts
import { generateConfig } from "@fbritoferreira/strapi";

export default generateConfig({
	types: {
		url: "https://cms.example.com",
		password: process.env.STRAPI_ADMIN_PASSWORD,
		output: "src/strapi-types.ts",
	},
	routes: {
		openapi: "https://cms.example.com/documentation/v1.0.0",
		output: "src/strapi-routes.ts",
	},
	graphql: {
		url: "https://cms.example.com/graphql",
		output: "src/strapi-graphql.ts",
	},
});
```

```sh
npx @fbritoferreira/strapi generate --config
npx @fbritoferreira/strapi generate --config --check
```

`generateConfig` is an identity function. It exists so the file is checked as you write it. Naming both `dir` and `url` under `types`, or leaving a section without its source, is a compile error. A `.ts` file can read `process.env` directly.

Every section is optional. They run in order, each writing its own file. A failing section does not stop the others: the command reports `2 of 3 generated` and exits 1, so one broken source cannot hide the rest.

## Lookup

Configs are looked up, in order, as `strapi-codegen.config.ts`, `.mts`, `.js`, `.mjs`, then `.json`. Pass a path to skip the lookup: `--config config/strapi.ts`. A bare `--config` with no value uses the lookup. Relative paths resolve against the current working directory.

A `.ts` config needs a Node that strips types (22.6 or newer). On anything older the command says so, and a `.mjs` or `.json` config works instead.

## Credentials

Flags and config fields fall back to the same environment variables:

| Field | Environment variable |
| --- | --- |
| `types.email` | `STRAPI_ADMIN_EMAIL` |
| `types.password` | `STRAPI_ADMIN_PASSWORD` |
| `routes.token`, `graphql.token` | `STRAPI_TOKEN` |
| `routes.password` | `STRAPI_DOCS_PASSWORD` |

Default output files, when `output` is omitted: `strapi-types.ts`, `strapi-routes.ts`, `strapi-graphql.ts`.

`watch.interval` is the poll period for URL sources under `--watch`. See [Watch mode](/codegen/watch).
