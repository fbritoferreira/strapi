---
"@fbritoferreira/strapi": minor
---

Paginated media library, opt-in refresh after a 401, and `publish()`.

- `files.findPage` calls `GET /api/upload/files/page` and returns `meta.pagination`. `files.find` still lists every file; current Strapi 5 ignores pagination on that path.
- `refreshOnUnauthorized` rotates a users-permissions refresh token on 401, adopts the new JWT, and retries the request once. Concurrent 401s share one rotation. Off unless configured.
- `collection.publish` and `single.publish` send `PUT` with `{ data: {} }` and `status=published`, which publishes a draft without changing it. Omitting `data` is a 400.
