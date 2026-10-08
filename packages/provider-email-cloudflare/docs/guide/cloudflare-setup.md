---
title: Cloudflare setup
description: Enable Cloudflare Email Sending, verify a domain, and create an API token.
---

# Cloudflare setup

Everything that has to exist on the Cloudflare side before Strapi can send.

## 1. Plan

Email Sending (outbound to arbitrary recipients) requires the **Workers Paid** plan. On the Free plan you can only send to [verified destination addresses](https://developers.cloudflare.com/email-service/configuration/email-routing-addresses/) inside your own account.

Sending is 3,000 emails/month included, then $0.35 per 1,000 — see the [pricing page](https://developers.cloudflare.com/email-service/platform/pricing/).

## 2. Onboard your sending domain

From the Cloudflare dashboard (Email Service → Email Sending), or with wrangler:

```bash
npx wrangler email sending enable yourdomain.com
```

Cloudflare then shows the DNS records to add (SPF + DKIM, and a verification record). Publish them at your DNS provider and wait for the domain to show as verified — until it is, sends fail with `E_SENDER_NOT_VERIFIED`-style errors, or `email.sending.error.authentication.forbidden` from the REST API.

::: tip
The domain used in `settings.defaultFrom` must be the onboarded one. Any local part works (`no-reply@`, `orders@`, `support@`) once the domain itself is verified.
:::

## 3. Create an API token

1. [Create a Cloudflare API token](https://dash.cloudflare.com/profile/api-tokens) with the **Email Sending** permission (account-level), scoped to the account that owns your domain.
2. Copy the token — this becomes `CLOUDFLARE_API_TOKEN`.
3. Copy your **account ID** from the dashboard sidebar or any zone's overview page — this becomes `CLOUDFLARE_ACCOUNT_ID`.

Never commit either value; keep them in `.env` / your secret manager. The provider only ever reads them from `providerOptions`.

## 4. Test outside Strapi

Confirm the credentials work before wiring Strapi:

```bash
curl "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/email/sending/send" \
  --header "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{
    "to": "you@yourdomain.com",
    "from": "no-reply@yourdomain.com",
    "subject": "Cloudflare Email Sending works",
    "html": "<p>It works.</p>",
    "text": "It works."
  }'
```

A `200` with `"success": true` means the token and domain are good. Send to an address you actually control — bounces from invented addresses damage your sender reputation.

## Next

Continue with [Configuration](/packages/provider-email-cloudflare/guide/configuration).
