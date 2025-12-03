---
"@fbritoferreira/strapi": patch
---

- Remove type: module to enable CommonJS support
- Add exports field for proper dual package resolution
- Create separate tsconfig.cjs.json for CommonJS builds
- Update build script to generate both ESM and CJS outputs
- Configure Vite to target Node.js 14+ for broader compatibility
