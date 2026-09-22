---
"@fbritoferreira/strapi": patch
---

Cover the remaining branches and hold coverage at 100%.

Tests for the paths that were never exercised: a page with no body and partial
offset pagination in `fetchAll`, a non-`Error` rejection and an error body
without `status`/`name` in `HttpClient`, a missing path param in
`buildRoutePath`, a GraphQL error without an `extensions.code`, failed auth
posts and non-404 logout errors, `delete` answering with `meta`, `--token` and
`--check` on the `--openapi` and `--graphql` sources, and several JSON Schema
shapes the OpenAPI printer had not seen.

Three pieces of unreachable defensive code are gone: `mustGet` in the
normalizer and a `??` fallback in `routesModel` both guarded invariants their
callers already establish, and `parseArgs` applies the CLI's boolean defaults
itself. The normalizer's comparators are exported and pinned by tests instead.

Coverage thresholds are now 100% on statements, branches, functions and lines.
