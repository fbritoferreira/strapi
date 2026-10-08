---
"@fbritoferreira/strapi-admin-api": patch
---

Fix ESM compatibility by adding required `strapi` plugin manifest (`kind: plugin`, `name: admin-api`), exposing `./package.json`, and converting `strapi-server.js` / `strapi-admin.js` from CommonJS `module.exports` to ESM `export default`.