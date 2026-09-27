# GraphQL

Strapi serves GraphQL at `/graphql` — at the origin, not under `/api` — when `@strapi/plugin-graphql` is installed. `strapi.graphql()` runs one operation there, with the same bearer token and `[error, data]` tuple as the REST clients. There is no `meta`.

```ts
const [err, data] = await strapi.graphql<{ articles: Article[] }>(
	`query Articles($locale: I18NLocaleCode) {
		articles(locale: $locale) { documentId title }
	}`,
	{ variables: { locale: "fr" } },
);
```

GraphQL errors come back as the error tuple, with the whole `errors` array in `details` and the single error's `extensions.code` as `name` (otherwise `"GraphQLError"`). A response with no `data` is also an error. A 404 — the plugin is not installed — says so and names `strapi.graphqlUrl`.

Pass `graphqlEndpoint` when the plugin's `endpoint` option is not `/graphql`. `operationName` selects one operation when the document contains several. `init` merges extra `fetch` options.

## Queries without writing GraphQL

`--graphql` registers every root field with its arguments and result, so the common operations need no document:

```sh
npx @fbritoferreira/strapi generate --graphql http://localhost:1337/graphql -o src/strapi-graphql.ts
```

```ts
import { strapiGraphqlArgs } from "./strapi-graphql";

const strapi = new Strapi({
	baseURL: "http://localhost:1337",
	defaultLocale: "en",
	graphqlArgs: strapiGraphqlArgs,
});

const [err, articles] = await strapi.query("articles", {
	args: { locale: "fr", pagination: { limit: 10 } },
	select: { documentId: true, title: true, author: { name: true } },
});
```

The client builds the document and the variables:

```graphql
query Articles($locale: I18NLocaleCode, $pagination: PaginationArg) {
	articles(locale: $locale, pagination: $pagination) {
		documentId
		title
		author { name }
	}
}
```

Arguments travel as variables rather than inline literals, so the server parses them as JSON — a string that looks like an enum stays a string, and nothing has to be escaped by hand. Their GraphQL types come from `strapiGraphqlArgs`, which is why the client needs it. Calling `query` or `mutate` without it returns a `TypeError` naming the field. Passing an argument the field does not declare is refused before anything is sent.

`select` is checked against the schema and narrows the result, the same way `fields` and `populate` narrow a REST read. Mutations use `strapi.mutate()` with the same options.

This does not cover fragments, aliases, directives, unions, or several operations in one document. Those are what typed documents are for.

## Typed documents

`graphql()` also takes a document that carries its own types — a `TypedDocumentNode`, or the `TypedDocumentString` graphql-codegen emits with `documentMode: "string"`. Both type arguments are then inferred, `variables` is required exactly when the document declares a required one, and the selection set itself is typed:

```ts
import { ArticlesDocument } from "./gql/graphql";

const [err, data] = await strapi.graphql(ArticlesDocument, { variables: { locale: "fr" } });
```

Point [graphql-codegen](https://the-guild.dev/graphql/codegen) at your Strapi instance:

```ts
import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
	schema: "http://localhost:1337/graphql",
	documents: ["src/**/*.{ts,tsx}"],
	generates: {
		"./src/gql/": { preset: "client", config: { documentMode: "string" } },
	},
};

export default config;
```

`documentMode: "string"` keeps the query as text. The default AST form works too — its source is read from `loc`. A document with neither comes back as an error tuple naming the fix, rather than sending an empty query.

No dependency is added for this. `TypedDocument<TData, TVariables>` matches the `__apiType` marker both forms carry.

## Schema types

The same `--graphql` command writes one exported type per object, interface, enum, input object and union, so query results and variables can be annotated with the schema's own names:

```ts
import type { Article, ArticleFiltersInput } from "./strapi-graphql";

const [err, data] = await strapi.graphql<{ articles: Article[] }, { filters: ArticleFiltersInput }>(
	"query Articles($filters: ArticleFiltersInput) { articles(filters: $filters) { documentId title } }",
	{ variables: { filters: { title: { eq: "Hello" } } } },
);
```

Those types describe the schema, not a selection: the generated `Article` has every field, not the ones a given query selected. Typed documents and `select` cover that case.

Introspection has to be reachable. Apollo disables it when `NODE_ENV=production`, so generate against a development instance. `--token` (or `STRAPI_TOKEN`) is sent when introspection is protected.
