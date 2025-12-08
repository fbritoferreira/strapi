---
"@fbritoferreira/strapi": minor
---

- Refactor constructor to use a config object `{ baseURL, uid, token? }` instead of positional params.
- Update `findMany()` to accept options `{ params?, locale?, all? }` and `find()` to include `all` param for consistency.
- Add pagination support: when `all: true`, methods automatically fetch all pages and merge results.
