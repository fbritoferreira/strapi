# Strapi Client

A fully-typed TypeScript client for Strapi 5's REST and GraphQL APIs.

## Quick Start

```typescript
import { strapi } from "@fbritoferreira/strapi";

const api = strapi({
	url: "http://localhost:1337",
	apiToken: "your-token",
});

const articles = await api.find("articles");
console.log(articles.data);
```

## Installation

### NPM

```bash
npm install @fbritoferreira/strapi
```

### Yarn

```bash
yarn add @fbritoferreira/strapi
```

### PNPM

```bash
pnpm add @fbritoferreira/strapi
```

### Bun

```bash
bun add @fbritoferreira/strapi
```

### JSR

```bash
deno add @fbritoferreira/strapi
```

## Configuration

```typescript
const api = strapi({
	url: "https://your-cms.com",
	apiToken: "your-token",
	headers: {
		"X-Custom-Header": "value",
	},
	timeout: 10000,
	retry: 3,
});
```

For complete documentation, see [Documentation](https://strapi.fbritoferreira.com/packages/client/).

## License

MIT
