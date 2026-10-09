# Cloudflare Email Sending provider for Strapi

Send Strapi's transactional email through [Cloudflare Email Service](https://developers.cloudflare.com/email-service/) — no SMTP relay, no third-party email SaaS. Drop-in replacement for the default `sendmail` provider.

```ts
await strapi.plugin('email').service('email').send({
  to: 'user@example.com',
  subject: 'Welcome!',
  html: '<h1>Welcome</h1>',
  text: 'Welcome',
});
```

## Prerequisites

- **Strapi 5** (`@strapi/strapi ^5.0.0`)
- A **Workers Paid** plan — Email Sending is not available on the Free plan
- A sending domain onboarded to Email Sending ([setup guide](https://strapi.fbritoferreira.com/packages/provider-email-cloudflare/guide/cloudflare-setup))
- A Cloudflare **API token** with the Email Sending permission, and your **account ID**

## Installation

```bash
npm install @fbritoferreira/strapi-provider-email-cloudflare
# yarn add / pnpm add / bun add the same package name
```

Install it from npm. The [JSR package](https://jsr.io/@fbritoferreira/strapi-provider-email-cloudflare) holds the TypeScript source and API docs, not the built `dist/` that Strapi loads.

## Configuration

```ts
// config/plugins.ts
export default ({ env }) => ({
  email: {
    config: {
      provider: '@fbritoferreira/strapi-provider-email-cloudflare',
      providerOptions: {
        apiToken: env('CLOUDFLARE_API_TOKEN'),
        accountId: env('CLOUDFLARE_ACCOUNT_ID'),
      },
      settings: {
        defaultFrom: 'no-reply@yourdomain.com',
        defaultReplyTo: 'support@yourdomain.com',
      },
    },
  },
});
```

Strapi now sends every `email.send()` call through Cloudflare. The full configuration reference lives in the [documentation](https://strapi.fbritoferreira.com/packages/provider-email-cloudflare/).

## Provider options

| Option | Required | Default | Description |
| --- | --- | --- | --- |
| `apiToken` | yes | — | Cloudflare API token with Email Sending permission |
| `accountId` | yes | — | Cloudflare account ID |
| `baseUrl` | no | `https://api.cloudflare.com/client/v4` | Override the API host (proxies, regional edges) |
| `timeoutMs` | no | `15000` | Request timeout |

`settings.defaultFrom` and `settings.defaultReplyTo` are used when a `send()` call omits `from` / `replyTo`.

## What is supported

`to`, `cc`, `bcc` (string or array), `from` and `replyTo` (including `Name <address>` form), `subject`, `html`, `text`, `headers`, and `attachments` (base64/Buffer content or a file `path`, with `cid` → inline images). `send()` resolves with Cloudflare's delivery result: `{ delivered, queued, permanent_bounces, suppressed_recipients, message_id }`.

Strapi options with no Cloudflare equivalent (`envelope`, `priority`, `icalEvent`, `dsn`, …) are ignored rather than silently mangled.

## Known limits

- 50 recipients per message (`to` + `cc` + `bcc`)
- 5 MiB per message including attachments
- Transactional email only — newsletters/marketing blasts belong on a dedicated platform

## Documentation

Full guides — Cloudflare setup, configuration, sending, and error codes — are at [strapi.fbritoferreira.com/packages/provider-email-cloudflare](https://strapi.fbritoferreira.com/packages/provider-email-cloudflare/).

## Issues

Report bugs and feature requests at [github.com/fbritoferreira/strapi/issues](https://github.com/fbritoferreira/strapi/issues).

## License

[MIT](./LICENCE.md)
