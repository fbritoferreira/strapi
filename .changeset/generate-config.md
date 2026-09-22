---
"@fbritoferreira/strapi": minor
---

Run every generator from one typed config file.

`strapi-client generate --config` reads `strapi-codegen.config.ts` (or `.mts`,
`.js`, `.mjs`, `.json`, or a path you pass) and runs each section it declares,
writing document types, route types and GraphQL types in one invocation.
`--check` applies to all of them, so CI needs a single command.

The config is typed by a new exported helper:

```ts
import { generateConfig } from "@fbritoferreira/strapi";

export default generateConfig({
	types: { url: "https://cms.example.com", password: process.env.STRAPI_ADMIN_PASSWORD },
	routes: { openapi: "https://cms.example.com/documentation/v1.0.0" },
	graphql: { url: "https://cms.example.com/graphql" },
});
```

`generateConfig` is an identity function whose only job is type-checking the
file: naming both `dir` and `url` under `types`, or leaving a section without
its source, will not compile. Being TypeScript, the file reads `process.env`
directly instead of needing an interpolation syntax.

Sections run in order and a failure does not stop the rest — the command
reports how many were generated and exits 1 if any failed. `GenerateConfig`,
`TypesFromDir`, `TypesFromUrl`, `RoutesGeneration` and `GraphqlGeneration` are
exported alongside the helper.
