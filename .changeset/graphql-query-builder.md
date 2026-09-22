---
"@fbritoferreira/strapi": minor
---

Run GraphQL operations without writing GraphQL.

`strapi-client generate --graphql` now registers every root field — its
arguments and its result — and exports `strapiGraphqlArgs` with the GraphQL type
of each argument. Pass that to the client and the common operations need no
document:

```ts
const [err, articles] = await strapi.query("articles", {
	args: { locale: "fr", pagination: { limit: 10 } },
	select: { documentId: true, title: true, author: { name: true } },
});
// articles: { documentId: string; title: string; author: { name: string } | null }[]
```

The client builds the document and sends the arguments as variables, so the
server parses them as JSON and nothing needs escaping. `select` is checked
against the schema and narrows the result the way `fields` and `populate` do for
REST; `strapi.mutate()` is the same for mutations.

Fragments, aliases, directives and multi-operation documents stay the domain of
`graphql()` with a typed document.
