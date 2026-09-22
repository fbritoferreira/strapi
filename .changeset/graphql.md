---
"@fbritoferreira/strapi": minor
---

Add GraphQL support.

`strapi.graphql(query, { variables, operationName })` runs an operation against
the endpoint `@strapi/plugin-graphql` serves — `/graphql` at the origin, not
under `/api` — reusing the configured token, timeout and `[error, data]` tuple.
GraphQL errors become the error tuple, with the `errors` array in `details` and
a single error's `extensions.code` as `name`; a 404 is reported as the plugin
not being installed. `graphqlEndpoint` on `StrapiConfig` overrides the path and
`strapi.graphqlUrl` exposes the resolved URL.

`strapi-client generate --graphql <url>` introspects that endpoint and writes one
exported type per object, interface, enum, input object and union, so query
results and variables can be annotated with the schema's own names. Output
defaults to `strapi-graphql.ts`; `--token` (or `STRAPI_TOKEN`) authenticates the
request. Selection sets are not modelled — use graphql-codegen when the query
documents themselves should drive the types.

`HttpClient.request` now accepts an absolute `http(s)` URL as well as a path
relative to the API root.
