# Demo Strapi app

A Strapi 5 app linked to this repo's packages, for trying changes against a
real Strapi instead of mocks:

- `@fbritoferreira/strapi-admin-api` plugin (`/admin-api/*`)
- `@fbritoferreira/strapi-provider-email-cloudflare` (only when Cloudflare credentials are set)
- `@fbritoferreira/strapi` client (`pnpm try-client`, `pnpm generate`)
- `@strapi/plugin-graphql` (`/graphql`)

It's private and never published. SQLite stores the data in `demo/.tmp/`.

The demo is its own pnpm project with its own lockfile, outside the root
workspace. That keeps Strapi's dependency tree out of the root install, CI and
Snyk. The packages are `link:` dependencies, so the demo always runs their
local `dist/`.

## Run it

```bash
# from the repo root: the plugins load from each package's dist/
pnpm install
pnpm build

cd demo
pnpm install
cp .env.example .env
pnpm develop
```

The admin panel is at http://localhost:1337/admin. On first boot the app seeds
two published articles, one draft and the homepage, and lets the public role
read them.

Create an admin from the CLI instead of the browser:

```bash
pnpm strapi admin:create-user --email admin@demo.local --password DemoPass123 --firstname Demo --lastname Admin
```

After changing a package, run `pnpm build` in it (or `pnpm watch` in admin-api
and the email provider) and restart `pnpm develop`.

## Content

| UID | Kind | Notes |
| --- | --- | --- |
| `api::article.article` | collection | Draft & Publish on: `title`, `slug`, `body` |
| `api::homepage.homepage` | single | `title`, `description` |

## Try the admin API plugin

```bash
TOKEN=$(curl -s -X POST localhost:1337/admin/login -H 'content-type: application/json' \
  -d '{"email":"admin@demo.local","password":"DemoPass123"}' | jq -r .data.token)

curl -s localhost:1337/admin-api/users -H "Authorization: Bearer $TOKEN"
curl -s -X POST localhost:1337/admin-api/tokens -H "Authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -d '{"name":"demo","type":"full-access"}'
```

## Try the client

```bash
pnpm try-client                              # reads: REST, all pages, single type, GraphQL
STRAPI_TOKEN=<accessKey> pnpm try-client     # also creates an article
pnpm generate                                # writes types/strapi.ts from the schemas
```

## Try the email provider

Set `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` and `EMAIL_FROM` (an address
on a domain verified in Cloudflare Email Service) in `.env`, then restart. Use
**Settings → Email → Send test email** in the admin panel. Without the token,
Strapi stays on its default sendmail provider.

## Notes

- The app is TypeScript and ships its own `tsconfig.json`. Without it, Strapi
  finds the repo-root tsconfig and its bundled TypeScript 5.9 fails on it.
- The admin panel build is `pnpm build:admin`.
