# @fbritoferreira/strapi-admin-api

## 1.0.3

### Patch Changes

- ad3d7ac: Fix ESM compatibility by adding required `strapi` plugin manifest (`kind: plugin`, `name: admin-api`), exposing `./package.json`, and converting `strapi-server.js` / `strapi-admin.js` from CommonJS `module.exports` to ESM `export default`.

## 1.0.1

### Patch Changes

- 164f12b: Fix README documentation links to point at the docs site, and drop stray frontmatter from the admin-api README.
