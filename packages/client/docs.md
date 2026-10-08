---
theme: strapi
layout: docs
title: Strapi Client
description: TypeScript client for the Strapi 5 REST and GraphQL APIs
---

# Strapi Client

A fully-typed TypeScript client for Strapi 5's REST and GraphQL APIs with support for collections, single types, auth, uploads, and custom routes.

## Installation

```bash
npm install @strapi/sdk-js
# or
pnpm add @strapi/sdk-js
# or
yarn add @strapi/sdk-js
```

## Quick Start

```typescript
import { strapi } from '@strapi/sdk-js';

const strapiAPI = strapi({
  url: 'http://localhost:1337',
  apiToken: 'your-api-token',
});

// Fetch a collection
const articles = await strapiAPI.find('articles');
console.log(articles.data);

// Get a single entry
const article = await strapiAPI.findOne('articles', 1);
console.log(article.data);
```

## Configuration

The client accepts a configuration object with the following options:

```typescript
interface StrapiConfig {
  url: string;
  apiToken?: string;
  version?: 'v4' | 'v5' | 'v1';
  headers?: Record<string, string>;
  timeout?: number;
  retry?: number;
}

const strapiAPI = strapi({
  url: 'https://your-cms.com',
  apiToken: 'your-api-token',
  headers: {
    'X-Custom-Header': 'value',
  },
  timeout: 10000, // 10 seconds
  retry: 3, // Number of retry attempts
});
```

## Documentation

### Quick Start Guide
::: docs
@/docs/guide/quick-start.md
:::

### Authentication
::: docs
@/docs/guide/authentication.md
:::

### Content Types
::: docs
@/docs/guide/collections.md
:::

### Single Types
::: docs
@/docs/guide/single-types.md
:::

### Querying
::: docs
@/docs/guide/querying.md
:::

### Pagination
::: docs
@/docs/guide/pagination.md
:::

### Authentication API
::: docs
@/docs/guide/authentication.md
:::

### GraphQL Integration
::: docs
@/docs/graphql/index.md
:::

### Config Generation
::: docs
@/docs/codegen/index.md
:::

### Reference
::: docs
@/docs/reference/index.md
:::

## Usage Examples

### Basic CRUD Operations

```typescript
import { strapi } from '@strapi/sdk-js';

const api = strapi({
  url: 'http://localhost:1337',
  apiToken: 'your-token',
});

// Create an entry
const created = await api.create('articles', {
  data: {
    title: 'My First Article',
    content: 'Hello, Strapi!',
  },
});

// Update an entry
const updated = await api.update('articles', created.data.id, {
  data: {
    title: 'Updated Title',
  },
});

// Delete an entry
await api.delete('articles', created.data.id);

// Find with filters
const filtered = await api.find('articles', {
  filters: {
    title: {
      $contains: 'Strapi',
    },
  },
});

// Find with pagination
const paginated = await api.find('articles', {
  start: 0,
  limit: 10,
  sort: 'createdAt:desc',
});
```

### Working with Files

```typescript
// Upload a file
const file = await api.upload('path/to/file.jpg');

// Attach file to an entry
await api.update('articles', articleId, {
  data: {
    featuredImage: file.data.id,
  },
});

// Get file URL
const imageUrl = api.formatFileUrl({
  url: file.data.url,
  mime: file.data.mime,
  folder: file.data.folder,
});
```

### GraphQL Operations

```typescript
const articles = await api.graphql`
  query {
    articles {
      data {
        id
        attributes {
          title
          content
          createdAt
        }
      }
    }
  }
`;
```

### Error Handling

```typescript
try {
  const articles = await api.find('articles');
} catch (error) {
  if (error.response?.status === 404) {
    console.log('Not found');
  } else if (error.response?.status === 401) {
    console.log('Unauthorized');
  } else {
    console.log('Error:', error.message);
  }
}
```

## Advanced Features

### Custom Headers

```typescript
const api = strapi({
  url: 'http://localhost:1337',
  apiToken: 'your-token',
  headers: {
    'X-API-Version': 'v5',
    'X-Custom-Field': 'value',
  },
});
```

### Custom Fetch Adapter

```typescript
import { strapi } from '@strapi/sdk-js';

const api = strapi({
  url: 'http://localhost:1337',
  apiToken: 'your-token',
  fetchAdapter: async (url, options) => {
    // Your custom fetch implementation
    const response = await customFetch(url, options);
    return response;
  },
});
```

## API Reference

Full documentation for all client methods, parameters, and responses.

::: docs
@/docs/reference/index.md
:::

## Contributing

Contributions are welcome! Please see our [contributing guide](https://github.com/fbritoferreira/strapi/blob/main/CONTRIBUTING.md).

## License

MIT

## Links

- [GitHub Repository](https://github.com/fbritoferreira/strapi)
- [API Documentation](https://docs.strapi.io)
- [Strapi Blog](https://strapi.io/blog)
- [Strapi Community](https://community.strapi.io)
