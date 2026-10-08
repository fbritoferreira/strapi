# @fbritoferreira/strapi-monorepo

Monorepo containing Strapi client and admin API plugin.

## Packages

### [@fbritoferreira/strapi-client](./packages/client)

TypeScript client for the Strapi 5 REST and GraphQL APIs with typed collections, auth, uploads, and custom routes.

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

## License

MIT
