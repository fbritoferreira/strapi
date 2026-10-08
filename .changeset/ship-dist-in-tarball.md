---
"@fbritoferreira/strapi-admin-api": patch
---

Ship dist/ in the npm tarball

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
