---
"@fbritoferreira/strapi": patch
---

Test the Node versions this package claims to support.

CI ran on one version — whatever `.nvmrc` said — while `engines` claimed
`>=20`, so the range was an unverified claim. The test job now runs on Node 22,
24 and 26, and a second job builds the package and exercises the build on Node 20,
where Vitest cannot run at all (it needs `^22.12 || ^24 || >=26`).

That smoke check runs offline against `dist`: a read, an HTTP failure becoming
an error tuple, a timeout being classified (which needs `AbortSignal.any`), the
exports, and the CLI generating from the committed fixture.

`engines` is now `>=20.3`, the version that added `AbortSignal.any` — the
client merges your `signal` with its own timeout, so 20.0 to 20.2 never worked.
