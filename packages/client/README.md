---
theme: strapi
layout: docs
title: Strapi Client
description: TypeScript client for the Strapi 5 REST and GraphQL APIs
---

# Strapi Client

A fully-typed TypeScript client for Strapi 5's REST and GraphQL APIs.

## Quick Start

```typescript
import { strapi } from '@strapi/sdk-js';

const api = strapi({
  url: 'http://localhost:1337',
  apiToken: 'your-token',
});

const articles = await api.find('articles');
```

For full documentation, see the [shared documentation](./admin-api.md) which includes:
- Installation
- Configuration
- Authentication
- CRUD operations
- File uploads
- GraphQL integration
- Error handling
