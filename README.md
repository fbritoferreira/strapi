# @fbritoferreira/strapi

[![npm version](https://badge.fury.io/js/%40fbritoferreira%2Fstrapi.svg)](https://badge.fury.io/js/%40fbritoferreira%2Fstrapi)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![npm downloads](https://img.shields.io/npm/dm/@fbritoferreira/strapi.svg)](https://www.npmjs.com/package/@fbritoferreira/strapi)

A lightweight, generic TypeScript client for Strapi CMS v5, supporting CRUD operations, query parameters (filters, populate, pagination), and internationalization (i18n) with locale-specific creates/updates. Built with modern ES modules and Fetch API, it handles error responses and nested filters via `qs` serialization.

## Features

- **Generic TypeScript Support**: Define your entity types (e.g., `{ id: number; name: string; documentId?: string }`) for full type safety on requests/responses.
- **CRUD Operations**: `findMany`, `find`, `create`, `update`, `delete`.
- **Upsert**: Atomic create-or-update based on filters.
- **i18n Handling**: Automatic default locale creation and localization linking using numeric IDs.
- **Query Params**: Supports Strapi's filters (e.g., `{ name: { $eq: 'foo' } }`), populate (`*`), pagination, and locale.
- **Error Handling**: Returns `[ServiceError | null, Data | null]` tuples for async operations.
- **No Dependencies**: Only `qs` for query stringification; polyfills Fetch if needed.

## Installation

```sh
npm install @fbritoferreira/strapi
```

```sh
pnpm add @fbritoferreira/strapi
```

```sh
yarn add @fbritoferreira/strapi
```

Requires Node.js >=18 for modern Fetch. For older environments, polyfill `fetch`

## Quick Start

Import and instantiate the client with your Strapi base URL, optional auth token, and content-type UID (e.g., `articles` for `/api/articles`)

```ts
import { StrapiClient } from "@fbritoferreira/strapi";
import type {
	CreatePayload,
	QueryParams,
	StrapiFilters,
} from "@fbritoferreira/strapi/types";

interface Article {
	id: number;
	documentId?: string;
	title: string;
	content: string;
}

const client = new StrapiClient<Article>(
	"http://localhost:1337", // Strapi API base
	"your-jwt-token", // Optional for auth
	"articles" // UID for /api/articles
);

// Find multiple
const [err1, articles] = await client.findMany({ populate: ["*"] });
if (!err1 && articles) {
	console.log(articles); // Article[]
}

// Find one by ID
const [err2, article] = await client.find({ id: 1 });
if (!err2 && article) {
	console.log(article); // Article | null
}

// Create (default locale 'en')
const payload: CreatePayload<Article> = {
	data: { title: "New Article", content: "Hello World" },
};
const [err3, newArticle] = await client.create({ payload });
if (!err3 && newArticle) {
	console.log(newArticle); // Article
}

// Upsert with filters (create if not exists)
const filters: StrapiFilters<Article> = { title: { $eq: "Existing Title" } };
const [err4, upserted] = await client.upsert({ payload, filters });
if (!err4 && upserted) {
	console.log(upserted); // Article
}
```

## i18n Usage

Strapi i18n uses locales (default 'en'). For non-default locales, provide `locale` option; the client auto-creates default if needed and links via base ID.

```ts
// Create in French (searches/creates 'en' first if missing)
const [err, frArticle] = await client.create({
payload,
locale: 'fr',
filters: { title: { $eq: 'Article Français' } } // For existence check
});
if (!err && frArticle) {
console.log(frArticle.documentId); // Shared document ID for localizations
}

// Update specific locale
const updatePayload: UpdatePayload<Article> = { data: { content: 'Updated FR' } };
const [err5, updated] = await client.update({ id: 1, payload: updatePayload, locale: 'fr' });

// Find with locale
const [err6, frArticles] = await client.findMany({ filters: { title: { $contains: 'Français' } }, 'fr'});

```

### Query Parameters

Pass `QueryParams<Article>` for filters, populate, etc. Nested filters use `$eq`, `$contains`, etc.

```ts
const params: QueryParams<Article> = {
	filters: { title: { $eq: "Exact Title" } },
	populate: ["category", "author"],
	pagination: { pageSize: 10 },
	locale: "fr",
};
const [err, paginated] = await client.findMany(params);
```

## Error Handling

Methods return `[ServiceError | null, Data | null]`. Check `err` for issues like 404 or network failures.

```ts
const [err, data] = await client.find({ id: 999 });
if (err) {
	console.error(err.message, err.status); // e.g., "Strapi API error: 404 Not Found"
}
```

## API Reference

See `src/types.ts` for full types. Key methods:

- `findMany(params?: QueryParams<T>, locale?: string): Promise<[ServiceError | null, T[] | null]>`
- `find(options: { id?: number | string; params?: QueryParams<T>; locale?: string }): Promise<[ServiceError | null, T | null]>`
- `create(options: { payload: CreatePayload<T>; params?: Omit<QueryParams<T>, 'filters'>; locale?: string; filters?: StrapiFilters<T> }): Promise<[ServiceError | null, T | null]>`
- `update(options: { id: number | string; payload: UpdatePayload<T>; params?: QueryParams<T>; locale?: string }): Promise<[ServiceError | null, T | null]>`
- `delete(options: { id: number | string; locale?: string }): Promise<[ServiceError | null, T | null]>`
- `upsert(options: { locale?: string; payload: CreatePayload<T>; filters?: StrapiFilters<T>; params?: Omit<QueryParams<T>, 'filters'> }): Promise<[ServiceError | null, T | null]>`

Constructor: `new StrapiClient<T>(baseURL: string, token?: string, uid: string)`

## Development

1. Clone and install: `git clone <repo> && pnpm install`
2. Run tests: `pnpm test` (uses Vitest)
3. Build: `pnpm build` (outputs to `dist/`)
4. Dev server: `pnpm dev` (for library previews)

Uses Vite for building and Vitest for testing.

## Contributing

1. Fork the repo.
2. Create a feature branch (`git checkout -b feature/amazing-feature`).
3. Commit changes (`git commit -m 'Add amazing feature'`).
4. Push (`git push origin feature/amazing-feature`).
5. Open a Pull Request.

## License

Distributed under the MIT License. See `LICENSE` for more information.
