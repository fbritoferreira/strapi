# OpenAPI routes

Content-type schemas describe documents, not routes. For custom routes and the plugin endpoints (`/auth/local`, `/users`, `/upload/files`), generate a `StrapiRoutes` registry from an OpenAPI document:

```sh
# Strapi 5 writes one with its own CLI (experimental)
cd ../my-strapi && npx strapi openapi generate --output ../my-app/spec.json

npx @fbritoferreira/strapi generate --openapi spec.json -o src/strapi-routes.ts

# a URL works too, including the documentation plugin's spec
npx @fbritoferreira/strapi generate \
  --openapi https://cms.example.com/documentation/v1.0.0/full_documentation.json

# or the documentation plugin's page, which inlines the spec
npx @fbritoferreira/strapi generate \
  --openapi https://cms.example.com/documentation/v1.0.0 -o src/strapi-routes.ts
```

The source can be a JSON document or a Swagger UI page. Recent versions of `@strapi/plugin-documentation` render the spec inline with `SwaggerUIBundle({ spec: … })` and serve no JSON endpoint, so the loader reads it out of the page. `--token` (or `STRAPI_TOKEN`) authenticates either.

## Restricted documentation pages

When the plugin runs with `restrictedAccess`, the page is behind a password rather than a token. It redirects to `/documentation/login` and keeps a session cookie. Pass `--password` (or `STRAPI_DOCS_PASSWORD`) and the loader signs in first and reuses that cookie:

```sh
npx @fbritoferreira/strapi generate \
  --openapi https://cms.example.com/documentation/v1.0.0 \
  --password "…" \
  -o src/strapi-routes.ts
```

Without it, a restricted page reports what to do rather than failing on the login form's HTML. A wrong password redirects with `error=password` and the loader says the password was refused. A 500 means the plugin could not store the session: the instance needs `strapi::session` in `config/middlewares.ts` and `APP_KEYS` set. A correct password with no `Set-Cookie` is reported as restricted access not being enabled.

## Calling a route

The output augments `StrapiRoutes` with one entry per route, keyed `"<METHOD> <path>"`:

```ts
import "./strapi-routes";

const [err, session] = await strapi.route("POST /auth/local", {
	body: { identifier: "me@example.com", password: "…" },
});
const [, file] = await strapi.route("GET /upload/files/{id}", { params: { id: 7 } });
```

Path params are substituted into the path. `query` is serialized like collection params. The body is returned exactly as Strapi sends it — these routes have no `data`/`meta` envelope, so `route()` does not unwrap one. `init` merges extra `fetch` options.

Use OpenAPI for routes, not for documents. Strapi's generated spec is lossier than its schemas: a dynamic zone arrives as `{"type":"array","items":{}}` with the component union gone, responses carry no `meta`, and `documentId` is described as a UUID. Keep generating document types from `--dir` or `--url`. The two outputs are separate files and work side by side.

Routes whose path is a raw regex (Strapi emits `/connect/(.*)` for provider callbacks) are skipped: they cannot be called by name.
