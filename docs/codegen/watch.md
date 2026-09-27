# Watch mode

`--watch` generates everything once, then keeps each file up to date while you edit schemas.

```sh
npx @fbritoferreira/strapi generate --config --watch
npx @fbritoferreira/strapi generate --config --watch --interval 5000
npx @fbritoferreira/strapi generate --dir ../my-strapi -o src/strapi-types.ts --watch
```

```text
types: watching ../my-strapi/src
graphql: polling http://localhost:1337/graphql every 2s
types: wrote src/strapi-types.ts (12 types)
graphql: waiting for http://localhost:1337/graphql (connection refused)
config: watching strapi-codegen.config.ts
types: regenerated src/strapi-types.ts (13 types)
graphql: regenerated src/strapi-graphql.ts (48 types)
```

## What is watched

| Source | Trigger |
| --- | --- |
| `types.dir` | File events under the project's `src/api/*/content-types/` and `src/components/*/*.json`, debounced for 200ms because Strapi saves several files at once |
| `routes.openapi` as a local file | File events for that file |
| `types.url`, `graphql.url`, `routes.openapi` as a URL | Polling every `--interval` milliseconds, or `watch.interval` in the config (default 2000) |
| The config file | File events. The config is reloaded and everything it declares is re-planned. |

A file is written only when its contents change, so an edit that does not change the generated types leaves the file, and anything watching it, alone.

When a running instance goes away (Strapi restarts after a Content-Type Builder save), the section prints one `waiting for` line and picks up again once the instance answers. A section that fails prints its error once, until the message changes. A config that no longer loads is reported, and the previous one keeps running.

`--url` sources keep their admin session between polls. Strapi allows five admin logins per five minutes by default, so logging in on every poll would lock the account out.

```ts
export default generateConfig({
	types: { dir: "../my-strapi", output: "src/strapi-types.ts" },
	graphql: { url: "http://localhost:1337/graphql", output: "src/strapi-graphql.ts" },
	watch: { interval: 5000 },
});
```

`--interval` overrides `watch.interval`. `--watch` works for a single source too, and cannot be combined with `--check`. Stop it with Ctrl-C (`SIGINT` or `SIGTERM`).

Directory watching uses `fs.watch` with `recursive`, which Node supports on macOS, Windows and Linux. If a directory cannot be watched, the section falls back to polling. Changes to modules that a `.ts` or `.mjs` config imports are not picked up until a restart.
