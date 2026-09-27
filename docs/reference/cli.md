# CLI

```text
strapi-client generate (--config [file] | --dir <path> | --url <baseURL> | --openapi <spec> | --graphql <url>) [options]
```

The binary is `strapi-client`. `npx @fbritoferreira/strapi generate` runs it. It is published on npm, not JSR.

Exactly one source, or `--config` for every section of a config file.

## Sources

| Flag | Reads | Writes |
| --- | --- | --- |
| `--dir <path>` | `src/api/**/schema.json` and `src/components/**/*.json` in a Strapi project | `StrapiContentTypes` / `StrapiSingleTypes` |
| `--url <baseURL>` | Content-Type Builder on a running instance, after `POST /admin/login` | same |
| `--openapi <spec>` | An OpenAPI JSON file or URL, or a documentation-plugin page | `StrapiRoutes` |
| `--graphql <url>` | Introspection of a GraphQL endpoint | schema types and `strapiGraphqlArgs` |
| `--config [file]` | Every section of a config file | one file per section |

## Options

| Flag | Environment variable | Meaning |
| --- | --- | --- |
| `--email` | `STRAPI_ADMIN_EMAIL` | Admin email for `--url` |
| `--password` | `STRAPI_ADMIN_PASSWORD` for `--url`, `STRAPI_DOCS_PASSWORD` for a restricted OpenAPI page | |
| `--token` | `STRAPI_TOKEN` | Bearer token for `--openapi` URLs and `--graphql` |
| `-o, --output <file>` | | Output file. Default `strapi-types.ts`, `strapi-routes.ts`, or `strapi-graphql.ts` |
| `--include-plugins` | | Also emit plugin content types. `api::*` only by default |
| `--check` | | Exit 1 if the output is missing or out of date. Writes nothing. Cannot be combined with `--watch` |
| `--watch` | | Generate, then regenerate as the source changes. Stop with Ctrl-C |
| `--interval <ms>` | | Poll period for a URL source under `--watch`. Default `2000`. Overrides `watch.interval` |
| `-h, --help` | | Print usage |

`--config` with no path looks for `strapi-codegen.config.ts`, `.mts`, `.js`, `.mjs`, then `.json` in the current directory.

Exit code `0` means every requested file was written or already up to date. Exit code `1` means a source failed, a `--check` file was stale, or the arguments were invalid. Under `--config`, one failing section does not skip the others; the summary line is `N of M generated`.
