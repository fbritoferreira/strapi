# Installation

Requires Node.js >= 20.3, for `AbortSignal.any`, which merges your `signal` with the client's timeout. Ships ESM and CommonJS builds with bundled type declarations.

::: code-group

```sh [npm]
npm install @fbritoferreira/strapi
```

```sh [pnpm]
pnpm add @fbritoferreira/strapi
```

```sh [yarn]
yarn add @fbritoferreira/strapi
```

:::

## From JSR

The same package is published to [JSR](https://jsr.io/@fbritoferreira/strapi) as TypeScript source, for Deno, Bun and npm-compatible projects.

::: code-group

```sh [Deno]
deno add jsr:@fbritoferreira/strapi
```

```sh [npm]
npx jsr add @fbritoferreira/strapi
```

```sh [pnpm]
pnpm dlx jsr add @fbritoferreira/strapi
```

```sh [Bun]
bunx jsr add @fbritoferreira/strapi
```

:::

In Deno you can also import it without installing:

```ts
import { Strapi } from "jsr:@fbritoferreira/strapi";

const strapi = new Strapi({ baseURL: "http://localhost:1337", defaultLocale: "en" });
```

The JSR package exports the client library only. The `strapi-client` CLI is available from npm.
