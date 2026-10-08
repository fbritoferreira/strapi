---
title: Sending email
description: Send(), templated email, attachments, the returned delivery result, and Cloudflare error codes.
---

# Sending email

Once [configured](/packages/provider-email-cloudflare/guide/configuration), nothing changes about how Strapi sends email — the provider swaps out underneath.

## Basic send

```ts
await strapi.plugin('email').service('email').send({
  to: 'user@example.com',
  from: 'no-reply@yourdomain.com', // optional when settings.defaultFrom is set
  replyTo: 'support@yourdomain.com', // optional when settings.defaultReplyTo is set
  subject: 'Order confirmed',
  html: '<h1>Your order is confirmed</h1>',
  text: 'Your order is confirmed.',
});
```

Always send both `html` and `text`: some clients show only the plain-text part, and HTML-only messages score worse with spam filters.

## Multiple recipients

`to`, `cc`, and `bcc` accept a string or an array, and `Name <address>` forms:

```ts
await strapi.plugin('email').service('email').send({
  to: ['first@example.com', 'Billing <billing@example.com>'],
  cc: 'manager@example.com',
  bcc: ['archive@example.com'],
  subject: 'Invoice #1042',
  html: '<p>Invoice attached.</p>',
  text: 'Invoice attached.',
});
```

50 recipients max across all three fields combined.

## Templated email

`sendTemplatedEmail()` compiles lodash templates from your content types, then hands the result to the same `send()`:

```ts
await strapi.plugin('email').service('email').sendTemplatedEmail(
  { to: user.email },
  {
    subject: 'Welcome <%= user.firstname %>',
    text: 'Welcome <%= user.firstname %>!',
    html: '<h1>Welcome <%= user.firstname %>!</h1>',
  },
  { user }
);
```

## Custom headers

```ts
await strapi.plugin('email').service('email').send({
  to: 'user@example.com',
  subject: 'Your weekly digest',
  html: '<p>Digest</p>',
  text: 'Digest',
  headers: {
    'List-Unsubscribe': '<https://yourdomain.com/unsubscribe?id=abc123>',
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  },
});
```

Cloudflare validates headers against an [allowlist](https://developers.cloudflare.com/email-service/reference/headers/); combined custom headers are capped at 16 KB.

## Attachments

Attachments follow the shape Strapi passes to its providers. All of these work:

```ts
await strapi.plugin('email').service('email').send({
  to: 'customer@example.com',
  subject: 'Your invoice',
  html: '<p>Invoice attached.</p>',
  text: 'Invoice attached.',
  attachments: [
    // base64 content
    { filename: 'invoice.pdf', content: pdfBase64, encoding: 'base64' },
    // utf-8 string content (encoded for you)
    { filename: 'receipt.txt', content: 'Thank you' },
    // a file on disk — read and encoded for you
    { path: '/app/files/receipt.pdf' },
    // inline image referenced as <img src="cid:logo">
    { filename: 'logo.png', content: logoBuffer, cid: 'logo' },
  ],
});
```

MIME type is taken from `type` / `contentType`, otherwise guessed from the file extension (`application/octet-stream` as a last resort). `cid` attachments are sent with `disposition: inline`.

Total message size including attachments: 5 MiB.

## What `send()` resolves with

Cloudflare returns per-recipient delivery status, and the provider passes it straight through:

```ts
const result = await strapi.plugin('email').service('email').send({ /* … */ });

result; // {
//   delivered: ['user@example.com'],
//   queued: [],
//   permanent_bounces: [],
//   suppressed_recipients: [],
//   message_id: '<…@mail>',
// }
```

## Options with no Cloudflare equivalent

Strapi's `send()` also documents `envelope`, `priority`, `inReplyTo`, `references`, `list`, `icalEvent`, and `dsn`. Cloudflare's REST API has no counterpart for these, so the provider **ignores** them rather than sending something subtly wrong. Use `headers` for anything that maps to a real header (threading `In-Reply-To`/`References`, `List-Unsubscribe`, …).

## Errors

Failures throw, so wrap sends you don't want to break a request with `try/catch`:

```ts
try {
  await strapi.plugin('email').service('email').send({ /* … */ });
} catch (error) {
  strapi.log.error(`email failed: ${error.message}`);
}
```

The message carries Cloudflare's numeric code and machine-readable reason:

```text
Cloudflare email sending failed: 10102 email.sending.error.authentication.forbidden
```

| HTTP | Code | Meaning | Retry? |
| --- | --- | --- | --- |
| 400 | 10001 / 10200 / 10202 | Invalid request, message too big, invalid content | No — fix the message |
| 401 | 10101 | Missing or invalid API token | No — fix credentials |
| 403 | 10102 / 10105 / 10203 | Token lacks permission / not entitled / sending disabled | No |
| 429 | 10004 | Rate limited | Yes — exponential backoff |
| 500 | 10002 | Cloudflare internal error | Yes — exponential backoff |

Validation errors happen before the request too: a missing `subject`, missing body, or malformed address throws immediately with a readable message instead of hitting the API.

## Limits

| Limit | Value |
| --- | --- |
| Recipients per message | 50 (`to` + `cc` + `bcc`) |
| Message size | 5 MiB including attachments |
| Subject | 998 characters |
| Custom headers | 16 KB combined |
| Monthly quota | 3,000 included, then $0.35/1,000 |

Full details: [Cloudflare limits](https://developers.cloudflare.com/email-service/platform/limits/).
