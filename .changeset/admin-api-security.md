---
"@fbritoferreira/strapi-admin-api": minor
---

Enforce Strapi admin permissions on every route and fix several Strapi 5 compatibility bugs.

**Behaviour changes — check before upgrading:**

- Every `/admin-api/*` route now requires the same admin permission Strapi uses for its own settings pages (`admin::users.read|create|update|delete`, `admin::api-tokens.read|create|update|delete`). Before, any authenticated admin, whatever their role, could create super admins, reset other users' passwords and mint full-access API tokens. Super admins are unaffected; other roles get `403` until the matching permission is granted under Settings → Roles.
- `POST /admin-api/users` now requires `role` (a role id) or `roles` (an array of role ids) and assigns those roles. It no longer silently makes every new user a super admin.
- Passwords on create, update and reset-password must follow Strapi's admin password rule (8+ characters, at most 72 bytes, with lowercase, uppercase and a digit). Weak passwords get `400`.
- `GET /admin-api/users` only accepts pagination, `sort` and `filters` on non-secret fields. Filters or sorting on `password`, `resetPasswordToken` and other fields are ignored.
- The package's main export now defaults to the same plugin factory as `strapi-server.js`. The old default export referenced a router API that does not exist.
- The package is no longer published to JSR: that build could not be loaded by Strapi. Install from npm.
- `engines.node` is now `^20.19.0 || >=22.12.0`, the Node versions that can `require()` this ESM plugin.

**Fixes:**

- Token list and create pass the calling admin to Strapi's api-token service, as Strapi 5.53+ requires (the list endpoint crashed before).
- Token `lifespan`/`expiresAt` changes on update and refresh are now saved. Strapi's service dropped them. `lifespan` must be `null` or 7, 30 or 90 days in ms, otherwise the request gets `400`.
- Strapi `ValidationError`s from the token endpoints return `400` instead of `500`.
