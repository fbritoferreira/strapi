# @fbritoferreira/strapi

## 0.15.1

### Patch Changes

- e5222b1: Bring the documentation up to date with the current API.
  
  The README gains a feature summary and a contents list, a Deno `jsr:` usage
  example, `auth`, generated routes and GraphQL in the clients table, the
  `__populatable` marker in what the generator emits, a note that `delete` now
  answers with the deleted document, and a Recipes section — search and paginate,
  narrow a list view, upsert by slug, upload and attach, sign in and refresh,
  Next.js tag revalidation, localized updates.
  
  Those recipes live in `src/cli/__fixtures__/readme-recipes.ts` and are
  type-checked, so an example that stops compiling fails the build.
  
  The module doc — what JSR renders — covers the whole surface rather than
  collections alone, and the package description no longer describes a
  CRUD-only client.

## 0.15.0

### Minor Changes

- 3bf45ec: Match the plugin clients to their actual routes.
  
  `/api/users` and `/api/upload` are not content-API routes, so they never
  accepted `status`, `locale` or `_q`. Their params are now the sets Strapi
  declares: `PluginListQueryParams` (`fields`, `populate`, `sort`, `pagination`,
  `filters`) for `users().findMany` and `files.find`, `PluginFindQueryParams`
  (`fields`, `populate`) for `users().find`, `users().me` and `files.findOne`, and
  `filters` alone for `users().count`. `files.findOne` now sends those params,
  which it previously ignored.
  
  `StrapiUser` gains `role`, typed as the role id or a `StrapiRole` when
  populated. `StrapiMedia` gains `focalPoint` and `related`, both of which the
  upload plugin returns.
  
  `delete` takes the params its route declares — `fields`, `populate` and
  `filters` on a collection, `fields` and `populate` on a single type — and
  returns the deleted document, narrowed by those params, or `null` when Strapi
  answers with an empty body. It previously returned `null` unconditionally and
  `DeleteQueryParams` was exported but unused.

## 0.14.0

### Minor Changes

- 613e93f: Add `strapi.auth`, a client for the users-permissions auth routes.
  
  `login`, `register`, `forgotPassword`, `resetPassword`, `changePassword`,
  `sendEmailConfirmation`, `refresh` and `logout`, each typed from the route's own
  contract and returning the body unwrapped — these routes have no `data`/`meta`
  envelope.
  
  Two details the types now carry: `register` answers with the user and **no**
  `jwt` when email confirmation is enabled, and `refreshToken` is present only in
  the `"refresh"` JWT mode (absent when it travels in an httpOnly cookie).
  `refresh` and `logout` exist only in that mode; a 404 from either is reported as
  `jwtManagement` not being set to `"refresh"` rather than a bare "Not Found".
  
  `strapi.setToken(jwt)` adopts a token for later requests, and `setToken(undefined)`
  clears it. Login does not apply its own JWT: one client is often shared, and
  rebinding its identity silently is rarely wanted.

## 0.13.0

### Minor Changes

- 985929a: Narrow read results to what the params selected.
  
  `findMany`, `find`, `findFirst`, `create`, `update`, `upsert` and the
  single-type client now return the document as Strapi actually sends it for the
  given params, exposed as `SelectedDoc<T, P>`:
  
  - with a literal `fields`, only those attributes, plus `id` and `documentId` —
    Strapi selects `[id, documentId, ...fields]`, nothing else;
  - populatable fields appear only when `populate` asks for them, and stop being
    optional when it does; `populate: "*"` covers all of them, and a dotted path
    populates its first segment.
  
  ```ts
  const [, list] = await articles.findMany({ params: { fields: ["title"], populate: ["author"] } });
  // { id: number; documentId: string; title: string; author: Author | null }[]
  ```
  
  Narrowing needs a generated type (the `__populatable` marker) and params passed
  inline. Params held in a variable, or a hand-written type with no marker, return
  the full document exactly as before.
  
  `fetchAll` takes a second type parameter so the row shape and the shape its
  params are typed against can differ.

## 0.12.0

### Minor Changes

- 2a88e1b: Add GraphQL support.
  
  `strapi.graphql(query, { variables, operationName })` runs an operation against
  the endpoint `@strapi/plugin-graphql` serves — `/graphql` at the origin, not
  under `/api` — reusing the configured token, timeout and `[error, data]` tuple.
  GraphQL errors become the error tuple, with the `errors` array in `details` and
  a single error's `extensions.code` as `name`; a 404 is reported as the plugin
  not being installed. `graphqlEndpoint` on `StrapiConfig` overrides the path and
  `strapi.graphqlUrl` exposes the resolved URL.
  
  `graphql()` also accepts a document that carries its own types — a
  `TypedDocumentNode`, or the `TypedDocumentString` graphql-codegen emits with
  `documentMode: "string"` — inferring both type arguments from it and requiring
  `variables` exactly when the document declares a required one. The source text
  is read from the document (`loc.source.body`, or its own `toString`), so no
  `graphql` dependency is added; a document carrying neither returns an error
  tuple naming the fix. `TypedDocument`, `GraphqlOptions` and `GraphqlArgs` are
  exported.
  
  `strapi-client generate --graphql <url>` introspects that endpoint and writes one
  exported type per object, interface, enum, input object and union, so query
  results and variables can be annotated with the schema's own names. Output
  defaults to `strapi-graphql.ts`; `--token` (or `STRAPI_TOKEN`) authenticates the
  request. Selection sets are not modelled — use graphql-codegen when the query
  documents themselves should drive the types.
  
  `HttpClient.request` now accepts an absolute `http(s)` URL as well as a path
  relative to the API root.

## 0.11.0

### Minor Changes

- afc448d: Generate route types from an OpenAPI document.
  
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

## 0.10.0

### Minor Changes

- 177562d: Split `fields` from `populate` in generated types.
  
  `strapi-client generate` now emits a `__populatable` marker on every content
  type and component, listing the fields Strapi populates (relations, components,
  media, dynamic zones). `fields` and `sort` accept only the remaining scalar
  fields; `populate` accepts only the marked ones, as a single field, a list, a
  dotted path or a nested map. Selecting a field with the wrong param is a compile
  error instead of a request Strapi silently ignores.
  
  The marker is type-level only: Strapi never returns it, and it is excluded from
  `filters`, `sort` and create/update payloads. Types written by hand, with no
  marker, keep accepting any key in both params.
  
  `Populate<T>` no longer falls back to `string[]`, so a typo in a populate list
  is caught for hand-written types too. `ScalarKey`, `PopulatableKey`,
  `PopulatePath` and `PopulatableMarker` are exported.

## 0.9.0

### Minor Changes

- d5193ad: Type query params per route, and fix `publicationFilter`.
  
  Each method now takes only the params its Strapi route accepts, mirroring the
  zod contracts Strapi declares for its core content-API routes: `find` no longer
  accepts `pagination` or `_q`, and `create`, `update` and `upsert` accept only
  `fields`, `populate` and the conditional locale / Draft & Publish params. The
  sets are exported as `ListQueryParams`, `FindQueryParams`, `WriteQueryParams`
  and `DeleteQueryParams`.
  
  `publicationFilter` was typed `"all" | "modified" | "published" | "unpublished"`.
  Strapi validates this param against eight publication cohorts and answers a 400
  for anything else, so three of those four values were runtime errors. It is now
  `PublicationFilter`: `never-published`, `has-published-version`, `modified`,
  `unmodified`, `never-published-document`, `has-published-version-document`,
  `published-without-draft`, `published-with-draft`. The deprecated
  `hasPublishedVersion` param Strapi still accepts is typed alongside it.
  
  Adds the `_q` full-text search param, which Strapi's list routes accept and this
  client had no way to express, and exports `Uid` and `DocOf` so wrappers can name
  the registry types.

## 0.8.0

### Minor Changes

- 491e8ec: Constrain collection and single-type uids to the typed registry.
  
  Once `StrapiContentTypes` / `StrapiSingleTypes` are augmented — by the file
  `strapi-client generate` emits, or by hand — `strapi.collection(uid)` and
  `strapi.single(uid)` reject a uid the registry does not declare, so a typo is a
  compile error instead of a silent `CollectionClient<object>`. A uid outside the
  registry now needs an explicit type argument (`strapi.collection<Article>(uid)`).
  `StrapiClientConfig["uid"]` is constrained the same way. Projects that do not
  augment the registry are unaffected: any uid is still accepted.
  
  `SortField<T>` no longer accepts an arbitrary `"anything:asc"` string. Sort
  entries must start with a key of `T`; relation paths such as `"author.name:asc"`
  keep working.

## 0.7.0

### Minor Changes

- f6e4c55: Add the `strapi-client generate` command. It reads Strapi 5 content-type and component schemas from a project directory (`--dir`) or from a running instance's Content-Type Builder admin API (`--url` with admin email and password) and writes a TypeScript file with one interface per type plus the `StrapiContentTypes` / `StrapiSingleTypes` module augmentation, so `strapi.collection("articles")` is typed without a type argument. `--check` exits 1 when the file is out of date, for CI. No new runtime dependencies.

## 0.6.0

### Minor Changes

- 458944a: Rework for Strapi 5. Breaking changes:
  
  - `id` is now `documentId: string` on `find`, `update`, `delete`. Strapi 5 routes accept `documentId` only.
  - `find` without an id is removed. Use `findFirst`.
  - Every method returns `[error, data, meta]`. `meta.pagination` carries `total` and `pageCount`. Two-element destructuring keeps working.
  - `T` no longer has to declare `id`.
  - `ServiceError` gains `name`, `details`, `cause`. Strapi's `error` body (validation details included) is copied into it.
  - `defaultLocale` is required. There is no `"en"` default.
  - New root `Strapi` class with `collection()`, `single()`, `users()`, `files`. `StrapiClient` stays as a shorthand and now takes `defaultLocale`.
  
  New:
  
  - Single types, users-permissions (`/api/users`) and upload plugin (`/api/upload`) clients.
  - `count()`, `findFirst()`.
  - Constructor options `headers`, `fetch`, `timeout` (default 10 s), `concurrency` (default 5 for `all: true`).
  - Per-call `init` (`RequestInit` plus Next.js `next` options) merged into every request.
  - `all: true` supports `pagination.start`/`limit` (offset mode).
  - `params` are sent on `create` and `update`, so `{ status: "published" }` reaches Strapi.
  - `StrapiContentTypes`/`StrapiSingleTypes` registry interfaces for typed `collection("articles")` calls.
  - `create` with a non-default locale and no `filters` now creates a fresh default-locale document instead of localizing the first document Strapi returns.

## 0.5.0

### Minor Changes

- ac7b886: - Add Strapi 5 query parameters to `QueryParams`: `status` (`"draft" | "published"`), `publicationFilter`, and offset pagination via `pagination.start` / `pagination.limit`. `publicationState` (Strapi 4) and `pagination.pageCount` are kept but marked deprecated.
  - Ship ESM as `dist/strapi.mjs` and CommonJS as `dist/strapi.cjs` with matching `.d.mts` / `.d.cts` declarations, so Node no longer warns about module type detection when importing the ESM build. Deep imports of the old `dist/strapi.es.js` / `dist/strapi.cjs.js` paths are no longer available; use the package entry point.
  - Declare `engines.node >= 20` (the client relies on the global Fetch API) and publish only `dist`, `README.md`, `LICENCE.md` and `CHANGELOG.md` via the `files` field.
  - Upgrade toolchain: TypeScript 6, ESLint 10, Vite 8, Vitest 5, Changesets 3, pnpm 12.

## 0.4.0

### Minor Changes

- 05000e1: - Refactor constructor to use a config object `{ baseURL, uid, token? }` instead of positional params.
  - Update `findMany()` to accept options `{ params?, locale?, all? }` and `find()` to include `all` param for consistency.
  - Add pagination support: when `all: true`, methods automatically fetch all pages and merge results.

## 0.3.1

### Patch Changes

- 456d542: - Remove type: module to enable CommonJS support
  - Add exports field for proper dual package resolution
  - Create separate tsconfig.cjs.json for CommonJS builds
  - Update build script to generate both ESM and CJS outputs
  - Configure Vite to target Node.js 14+ for broader compatibility

## 0.3.0

### Minor Changes

- 00a6d56: Update upsert and create endpoints to work with localized content

## 0.2.0

### Minor Changes

- 401ce7d: Initial release

## 0.1.0

### Minor Changes

- 401ce7d: Initial release
