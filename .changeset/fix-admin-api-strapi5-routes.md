---
"@fbritoferreira/strapi-admin-api": patch
---

Fix plugin loading on Strapi 5

The plugin registered no `controllers` and manually called route registration
with a Strapi 4 handler format, so Strapi could not resolve any endpoint:

- Export `controllers` from `strapi-server.js` so the plugin registry picks them up
- Declare routes via the declarative `routes` array (prefix and `info.pluginName`
  applied by `registerPluginRoutes`) instead of manual `strapi.server.routes()` calls
- Use `controller.method` handlers (`adminController.find`, `tokenController.revoke`)
- Route `/tokens` endpoints to `tokenController` (they previously pointed at
  `adminController`, which has no revoke/refresh actions)

Also fix the controllers for Strapi 5's data model:

- `admin::user` has `roles` (manyToMany), not `role`: populate/map `roles`, default new
  users to the `strapi-super-admin` role code, and guard `strapi-super-admin` on delete
- Manage API tokens through `strapi.admin.services['api-token']` (`admin::api-token`)
  instead of the nonexistent `admin::token` model; tokens are global, not per-user
  (response fields: `name`, `type`, `lifespan`, `expiresAt`, `accessKey` on create only)

Verified on Strapi 5.42: `/admin-api/users` and `/admin-api/tokens` CRUD, refresh,
revoke, super-admin delete guard, and 401 without auth all pass.
