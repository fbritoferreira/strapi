---
"@fbritoferreira/strapi": patch
---

Bring the documentation up to date with the current API.

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
