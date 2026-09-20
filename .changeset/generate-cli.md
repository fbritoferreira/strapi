---
"@fbritoferreira/strapi": minor
---

Add the `strapi-client generate` command. It reads Strapi 5 content-type and component schemas from a project directory (`--dir`) or from a running instance's Content-Type Builder admin API (`--url` with admin email and password) and writes a TypeScript file with one interface per type plus the `StrapiContentTypes` / `StrapiSingleTypes` module augmentation, so `strapi.collection("articles")` is typed without a type argument. `--check` exits 1 when the file is out of date, for CI. No new runtime dependencies.
