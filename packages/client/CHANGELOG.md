# @fbritoferreira/strapi

## 0.25.1

### Patch Changes

- b3ff24d: Fix several client bugs found in an audit.
  
  - `findMany({ all: true })` with offset pagination now steps by the limit Strapi actually applied, so a `limit` above the server's `maxLimit` no longer drops rows. A `limit` of `-1` or `0` returns the first page instead of looping forever, and `withCount: false` is dropped so every page is still fetched.
  - `upsert`, and `create` for a non-default locale, now look the document up among drafts. A draft-only document is updated or localized instead of duplicated.
  - With `refreshOnUnauthorized`, one request aborting no longer fails the shared token refresh for every other request waiting on it.
  - An aborted request now stops waiting out the retry backoff right away.
  - A GraphQL error answered with HTTP 400 keeps its messages and `extensions.code`, both in `strapi.graphql` and in `strapi-client generate --graphql`.
  - The bearer token is only sent to absolute URLs on the Strapi origin, not to other hosts such as a media bucket.
  - `auth.refresh()` without a `refreshToken` sends `credentials: "include"`, so an httpOnly refresh cookie is attached.
  - `strapi-client generate --config` now rejects `-o`, `--include-plugins`, `--token`, `--email` and `--password` (exit 2) instead of ignoring them.
  - Docs: rewrote the README against the real API, and corrected the validation issue shape, the Node version a `.ts` config needs, and the CLI exit codes.

## 0.25.0

### Minor Changes

- ebaf281: bump version for normal updates

## 0.24.1

### Patch Changes

- 164f12b: Fix README documentation links to point at the docs site, and drop stray frontmatter from the admin-api README.
