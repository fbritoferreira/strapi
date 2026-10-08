---
title: Configuration
description: providerOptions, default settings, and environment-specific configuration for the Cloudflare email provider.
---

# Configuration

The provider is configured in `/config/plugins.ts` alongside the rest of Strapi's plugins.

## Full example

```ts
// config/plugins.ts
export default ({ env }) => ({
  email: {
    config: {
      // Full package name — there is no `@strapi/provider-email-cloudflare` shortcut.
      provider: '@fbritoferreira/strapi-provider-email-cloudflare',
      providerOptions: {
        apiToken: env('CLOUDFLARE_API_TOKEN'),
        accountId: env('CLOUDFLARE_ACCOUNT_ID'),
        // Optional overrides:
        // baseUrl: 'https://api.cloudflare.com/client/v4',
        // timeoutMs: 15000,
      },
      settings: {
        defaultFrom: 'No Reply <no-reply@yourdomain.com>',
        defaultReplyTo: 'Support <support@yourdomain.com>',
        testAddress: 'you@yourdomain.com',
      },
    },
  },
});
```

::: warning
Strapi loads exactly one email provider, and only from `config/plugins.ts` (or `config/env/{env}/plugins.ts`). If the provider isn't picked up, check the file location first — a misplaced `plugins.ts` silently leaves you on `sendmail`.
:::

## `providerOptions`

| Option | Required | Default | Description |
| --- | --- | --- | --- |
| `apiToken` | yes | — | Cloudflare API token with the Email Sending permission |
| `accountId` | yes | — | Cloudflare account ID that owns the sending domain |
| `baseUrl` | no | `https://api.cloudflare.com/client/v4` | API host override, e.g. a corporate proxy |
| `timeoutMs` | no | `15000` | Per-request timeout; the send rejects when exceeded |

Missing `apiToken` or `accountId` throws at boot — Strapi refuses to start rather than failing on the first password-reset email.

## `settings`

| Option | Description |
| --- | --- |
| `defaultFrom` | Sender used when a `send()` call omits `from`. Accepts `a@b.com` or `Name <a@b.com>` |
| `defaultReplyTo` | Reply-to used when a `send()` call omits `replyTo` |
| `testAddress` | Recipient pre-filled in the admin panel's "Send test email" field |

Both `from` and `replyTo` are validated as email addresses before the request is sent.

## Environment variables

Keep credentials out of code:

```bash
# .env
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_ACCOUNT_ID=...
```

`.env` is read automatically outside production; in production inject them through your host's environment (Strapi Cloud, Docker, systemd, …).

## Per-environment configuration

Send development traffic somewhere harmless by overriding the whole `email` config:

```ts
// config/env/development/plugins.ts
export default ({ env }) => ({
  email: {
    config: {
      provider: '@fbritoferreira/strapi-provider-email-cloudflare',
      providerOptions: {
        apiToken: env('CLOUDFLARE_API_TOKEN'),
        accountId: env('CLOUDFLARE_ACCOUNT_ID'),
      },
      settings: {
        defaultFrom: `dev+${env('HOST', 'localhost')}@yourdomain.com`,
        defaultReplyTo: 'dev@yourdomain.com',
      },
    },
  },
});
```

## How Strapi resolves the provider

At boot Strapi lowercases `email.config.provider`, tries `@strapi/provider-email-<name>`, and falls back to the string as a module path — which is why the full package name above is required. The resolved module's `init(providerOptions, settings)` runs once, and everything else is `send()`.

The admin panel's *Settings → Email feature → Configuration* page shows this provider's name and your defaults (read-only), and lets you send a test email to `settings.testAddress`.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| Emails still go out via sendmail / dev warning appears | `config/plugins.ts` isn't where Strapi looks, or `provider` is misspelled |
| `Cloudflare email sending failed: 10101 …unauthorized` | Bad or expired `apiToken` |
| `Cloudflare email sending failed: 10102 …forbidden` | Token lacks Email Sending permission, or the account isn't entitled |
| `Cloudflare email sending failed: 10004 …throttled` | Rate limited — retry with backoff |
| `No sender address: pass 'from' or set settings.defaultFrom` | Neither a `from` argument nor `settings.defaultFrom` was provided |
| `Invalid email address: "…"` | A malformed address in `from`, `to`, `cc`, `bcc`, or `replyTo` |

Next: [Sending email](/packages/provider-email-cloudflare/guide/sending).
