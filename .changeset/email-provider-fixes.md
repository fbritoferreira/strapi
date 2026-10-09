---
"@fbritoferreira/strapi-provider-email-cloudflare": patch
---

Fall back to `settings.defaultReplyTo` when `replyTo` is an empty string. users-permissions sends `replyTo: ''`, so confirmation and reset-password emails used to drop the default. The troubleshooting guide now covers Cloudflare rejecting Strapi's default `no-reply@strapi.io` sender when `defaultFrom` is not set. The package is no longer published to JSR, because that build cannot be loaded as a Strapi provider. Install from npm.
