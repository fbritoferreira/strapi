# @fbritoferreira/strapi-monorepo

Monorepo for Strapi 5 tooling: a typed client, an admin API plugin and a Cloudflare email provider. Docs: https://strapi.fbritoferreira.com/

## Packages

### [@fbritoferreira/strapi](./packages/client)

TypeScript client for the Strapi 5 REST and GraphQL APIs with typed collections, auth, uploads, and custom routes.

### [@fbritoferreira/strapi-admin-api](./packages/admin-api)

Strapi 5 plugin that exposes REST endpoints for managing admin users and API tokens.

### [@fbritoferreira/strapi-provider-email-cloudflare](./packages/provider-email-cloudflare)

Email provider that sends Strapi's transactional email through Cloudflare Email Service's REST API, replacing the default sendmail provider.

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Lint all packages
pnpm lint
```

To try changes against a real Strapi, run the [demo app](./demo), which has every package wired in.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for changesets and how releases work.

## License

MIT
