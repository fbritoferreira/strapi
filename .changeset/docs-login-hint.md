---
"@fbritoferreira/strapi": patch
---

Say what a 500 from the documentation login usually means.

`@strapi/plugin-documentation` records "logged in" on a koa session, and only
the branch a correct password takes reaches that line — so an instance without
the session middleware answers 500 there while still redirecting a wrong
password cleanly. The error now names the likely cause (`strapi::session` in
`config/middlewares.ts`, `APP_KEYS` set) instead of reporting an unexplained
server error. 4xx responses are unchanged.
