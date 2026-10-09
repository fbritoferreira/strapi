# @fbritoferreira/strapi-admin-api

## 1.3.0

### Minor Changes

- b3ff24d: Enforce Strapi admin permissions on every route and fix several Strapi 5 compatibility bugs.
  
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

## 1.2.3

### Patch Changes

- 752da7d: Fix double-hashed passwords on admin user create/update/reset-password: password writes now go through Strapi's own user service (hash once via db.query) instead of entityService, which re-hashed them in the document-service transform so new credentials could never log in. Also persist firstName/lastName (the schema fields are firstname/lastname), stop masking 4xx validation errors as 500s, and guard against writing token fields through the user update body.

## 1.2.2

### Patch Changes

- 71b42d8: Ship dist/ in the npm tarball
  
  `packages/admin-api` had no `files` whitelist, so pnpm's publish applied the
  repo-root `.gitignore` (`dist/`) and stripped every compiled file except the
  auto-included `main` — 1.2.0 and 1.2.1 both published with only
  `dist/index.js`, so `strapi-server.js` died on
  `Cannot find module ./dist/controllers/admin.js`.
  
  - Add a `files` whitelist (`dist`, `strapi-server.js`, `strapi-admin.js`,
    readme/licence/changelog), matching how `packages/client` publishes
  - Add `scripts/smoke.mjs`: packs the tarball, extracts it, boots
    `strapi-server.js` from inside, and asserts both controllers and all 13
    routes register — CI's smoke job runs it for every package that has one, and
    packing is the only way to catch gitignore stripping

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
