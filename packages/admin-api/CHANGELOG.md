# @fbritoferreira/strapi-admin-api

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
