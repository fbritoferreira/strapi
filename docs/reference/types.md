# Types

These are exported from `@fbritoferreira/strapi`. Generated files augment the empty registry interfaces; you do not construct those.

## Clients

| Export | Role |
| --- | --- |
| `Strapi` | Root client. `collection`, `single`, `users`, `files`, `auth`, `route`, `graphql`, `query`, `mutate`, `setToken`. |
| `StrapiClient` | One collection. Same methods as `CollectionClient`. |
| `CollectionClient` | CRUD for `/api/<uid>`. |
| `SingleTypeClient` | `find`, `update`, `delete` for a single type. |
| `AuthClient` | `/api/auth/*`. |
| `UsersClient` | `/api/users`. |
| `FilesClient` | `/api/upload`. |
| `HttpClient` | Shared `fetch` wrapper. `request` returns `[error, body]`. |
| `generateConfig` | Types a codegen config file. Identity at runtime. |

## Results

`Result<T>` is `[ServiceError, null, null] | [null, T, StrapiMeta]`.

`StrapiMeta` is `{ pagination?: StrapiPagination } | null`. Pagination is page-shaped (`page`, `pageSize`, `pageCount`, `total`) or offset-shaped (`start`, `limit`, `total`).

`validationIssues(error)` returns `{ path, message, name? }[]`. `isValidationDetails` narrows `details`.

## Documents

`StrapiDocument` is `id`, `documentId`, `createdAt`, `updatedAt`, `publishedAt`, and optional `locale`.

`StrapiMedia` is an uploaded file. See [Uploads](/guide/uploads). `StrapiMediaFormat` is one generated size. `StrapiUser` and `StrapiRole` are the users-permissions shapes. `StrapiBlock` is one node of a blocks field (`type`, optional `children` and `text`).

`AuthSession` is `{ jwt, refreshToken?, user }`. `RegisterResult` makes `jwt` optional. `RefreshedSession` is `{ jwt, refreshToken? }`. `SentEmailConfirmation` is `{ email, sent }`. `LogoutResult` is `{ ok }`.

## Registries

Augment these, usually by importing a generated file:

- `StrapiContentTypes` — collection uid to document
- `StrapiSingleTypes` — single-type uid to document
- `StrapiRoutes` — `"METHOD /path"` to params, query, body and response
- `StrapiGraphqlQueries` / `StrapiGraphqlMutations` — root field to args and result

While a registry is empty, any uid is accepted and falls back to `object`. Once it has keys, an unknown uid is a compile error unless you pass an explicit type argument.

`__populatable` and `__relations` are type-level markers the generator adds. Strapi never returns them, and they are excluded from filters, sorts and write payloads.
