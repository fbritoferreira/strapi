---
"@fbritoferreira/strapi-provider-email-cloudflare": major
---

Add a Cloudflare Email Sending provider for Strapi's Email feature.

Sends transactional email through Cloudflare's
`POST /accounts/{account_id}/email/sending/send` REST API instead of the
default sendmail provider: `from`/`replyTo` with display names, recipient
lists, custom headers, and attachments (base64, buffers, or files on disk,
including inline `cid` images). Zero runtime dependencies.

First release — published as 1.0.0.
