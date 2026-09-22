---
"@fbritoferreira/strapi": minor
---

Read the OpenAPI document straight from a documentation page.

Recent `@strapi/plugin-documentation` versions render the spec inline with
`SwaggerUIBundle({ spec: … })` and serve no JSON endpoint — every usual path,
`/documentation/v1.0.0/full_documentation.json` included, answers 404. So
`generate --openapi` now accepts that page as a source and reads the document
out of it:

```sh
strapi-client generate --openapi https://cms.example.com/documentation/v1.0.0 -o src/strapi-routes.ts
```

JSON sources are unchanged; the page is only parsed when the body is not JSON,
and a page with nothing usable in it still reports the original error.
