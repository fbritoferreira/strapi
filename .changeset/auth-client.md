---
"@fbritoferreira/strapi": minor
---

Add `strapi.auth`, a client for the users-permissions auth routes.

`login`, `register`, `forgotPassword`, `resetPassword`, `changePassword`,
`sendEmailConfirmation`, `refresh` and `logout`, each typed from the route's own
contract and returning the body unwrapped — these routes have no `data`/`meta`
envelope.

Two details the types now carry: `register` answers with the user and **no**
`jwt` when email confirmation is enabled, and `refreshToken` is present only in
the `"refresh"` JWT mode (absent when it travels in an httpOnly cookie).
`refresh` and `logout` exist only in that mode; a 404 from either is reported as
`jwtManagement` not being set to `"refresh"` rather than a bare "Not Found".

`strapi.setToken(jwt)` adopts a token for later requests, and `setToken(undefined)`
clears it. Login does not apply its own JWT: one client is often shared, and
rebinding its identity silently is rarely wanted.
