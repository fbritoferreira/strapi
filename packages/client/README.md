# Strapi Client

A fully-typed TypeScript client for Strapi 5's REST and GraphQL APIs.

## Quick Start

```typescript
import { strapi } from '@fbritoferreira/client';

const api = strapi({
  url: 'http://localhost:1337',
  apiToken: 'your-token',
});

const articles = await api.find('articles');
console.log(articles.data);
```

## Installation

### NPM
```bash
npm install @fbritoferreira/client
```

### Yarn
```bash
yarn add @fbritoferreira/client
```

### PNPM
```bash
pnpm add @fbritoferreira/client
```

### Bun
```bash
bun add @fbritoferreira/client
```

### JSR
```bash
deno add @fbritoferreira/client
```

## Configuration

```typescript
const api = strapi({
  url: 'https://your-cms.com',
  apiToken: 'your-token',
  headers: {
    'X-Custom-Header': 'value',
  },
  timeout: 10000,
  retry: 3,
});
```

For complete documentation, see [Documentation](../../docs/packages/strapi-client/).

## License

MIT
