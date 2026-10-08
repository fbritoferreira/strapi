---
"@fbritoferreira/strapi-admin-api": patch
---

Fix double-hashed passwords on admin user create/update/reset-password: password writes now go through Strapi's own user service (hash once via db.query) instead of entityService, which re-hashed them in the document-service transform so new credentials could never log in. Also persist firstName/lastName (the schema fields are firstname/lastname), stop masking 4xx validation errors as 500s, and guard against writing token fields through the user update body.
