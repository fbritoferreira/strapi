---
title: Cloudflare Email Sending provider
description: Strapi email provider sending transactional email through Cloudflare Email Service's REST API.
---

# Cloudflare Email Sending

A drop-in [email provider](https://docs.strapi.io/cms/configurations/email-custom-providers) that routes Strapi's Email feature through [Cloudflare Email Service](https://developers.cloudflare.com/email-service/).

It replaces the default `sendmail` provider (which is only suitable for local development) with Cloudflare's transactional email API: no SMTP relay to run, no separate email SaaS, and delivery is authenticated with SPF/DKIM by Cloudflare for your onboarded domain.

## Installation

::: code-group

```bash [npm]
npm install @fbritoferreira/strapi-provider-email-cloudflare
```

```bash [yarn]
yarn add @fbritoferreira/strapi-provider-email-cloudflare
```

```bash [pnpm]
pnpm add @fbritoferreira/strapi-provider-email-cloudflare
```

```bash [bun]
bun add @fbritoferreira/strapi-provider-email-cloudflare
```

:::

## Quick start

1. [Set up Cloudflare Email Sending](/packages/provider-email-cloudflare/guide/cloudflare-setup) for your domain and create an API token.
2. Point Strapi's `email` config at the provider:

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

3. Send as usual — from a controller, service, or lifecycle hook:

```ts
await strapi.plugin('email').service('email').send({
  to: 'user@example.com',
  subject: 'Welcome!',
  html: '<h1>Welcome</h1>',
  text: 'Welcome',
});
```

Every `send()` call now hits Cloudflare's `POST /accounts/{account_id}/email/sending/send`.

## How it fits into Strapi

Strapi's Email feature delegates delivery to a provider module: at boot it resolves `email.config.provider`, calls `init(providerOptions, settings)`, and routes all `email.send()` traffic to the returned `send()` function. This package is that module — there is no admin UI, no routes, and no extra process. See [Strapi's provider documentation](https://docs.strapi.io/cms/configurations/email-custom-providers) for the contract it implements.

## Requirements

- Strapi 5 (`@strapi/strapi ^5.0.0`)
- Cloudflare **Workers Paid** plan (Email Sending is not on the Free plan)
- A domain onboarded to Email Sending, and an API token with Email Sending permission
- Node 20.3 or newer

## Guides

- [Cloudflare setup](/packages/provider-email-cloudflare/guide/cloudflare-setup) — plan, domain, DNS records, API token, account ID
- [Configuration](/packages/provider-email-cloudflare/guide/configuration) — provider options, defaults, environment variables
- [Sending email](/packages/provider-email-cloudflare/guide/sending) — examples, attachments, returned result, errors and limits
