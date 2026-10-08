# @fbritoferreira/strapi-admin-api

## 1.2.1

### Patch Changes

- 21a7219: Fix plugin loading on Strapi 5
  
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

## 1.2.0

### Minor Changes

- fe92851: ## Summary
  
  Fixed Strapi 5 compatibility in the admin-api package.
  
  ## Files Changed
  
  - `packages/admin-api/src/index.ts` - Updated import statement to properly import the server plugin
  
  ## Details
  
  Updated `packages/admin-api/src/index.ts` to add the missing import for the server plugin:
  
  ```typescript
  import plugin from "./server.js";
  ```
  
  This aligns with the Strapi 5 API where plugins are imported and exported as default.

## 1.1.0

### Minor Changes

- ebaf281: bump version for normal updates

## 1.0.3

### Patch Changes

- ad3d7ac: Fix ESM compatibility by adding required `strapi` plugin manifest (`kind: plugin`, `name: admin-api`), exposing `./package.json`, and converting `strapi-server.js` / `strapi-admin.js` from CommonJS `module.exports` to ESM `export default`.

## 1.0.1

### Patch Changes

- 164f12b: Fix README documentation links to point at the docs site, and drop stray frontmatter from the admin-api README.
