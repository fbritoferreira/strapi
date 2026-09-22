---
"@fbritoferreira/strapi": minor
---

Generate route types from an OpenAPI document.

`strapi-client generate --openapi <file|url>` reads an OpenAPI 3 document — the
one `strapi openapi generate` writes, or the documentation plugin's — and emits
a `StrapiRoutes` registry keyed `"<METHOD> <path>"`, with the path params, query,
body and 200 response of each route, plus every `components.schemas` entry as a
named type. Output defaults to `strapi-routes.ts`; `--token` (or `STRAPI_TOKEN`)
authenticates a URL source.

`strapi.route()` calls those routes by name:

```ts
const [err, session] = await strapi.route("POST /auth/local", { body: { identifier, password } });
const [, file] = await strapi.route("GET /upload/files/{id}", { params: { id: 7 } });
```

Options are required for routes that declare path params or a body, path params
are substituted and encoded, and the response is returned unwrapped — these
routes have no `data`/`meta` envelope.

This covers custom and plugin routes, which content-type schemas cannot
describe. Document types should still come from `--dir` or `--url`: Strapi's
spec drops the component union of dynamic zones, omits `meta` from responses and
describes `documentId` as a UUID.
