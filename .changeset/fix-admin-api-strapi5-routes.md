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

Verified: `strapi develop` boots with the plugin enabled and
`/admin-api/users` + `/admin-api/tokens` return 401 (auth required) instead of failing startup.
