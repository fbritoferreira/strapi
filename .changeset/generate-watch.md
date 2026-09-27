---
"@fbritoferreira/strapi": minor
---

`strapi-client generate --watch`: generate once, then keep the output up to
date as the schema changes.

```sh
npx @fbritoferreira/strapi generate --config --watch
npx @fbritoferreira/strapi generate --dir ../my-strapi -o src/strapi-types.ts --watch
```

- A `dir` source is watched with `fs.watch` (recursive) on the project's
  content-type and component schemas, debounced so one save that writes several
  files regenerates once.
- A local OpenAPI file is watched directly.
- URL sources (a running instance for `types`, `routes` or `graphql`) are
  polled every 2 seconds, or every `--interval <ms>` / `watch.interval` in the
  config. An instance that is down prints one `waiting for` line and the watcher
  resumes when it answers again. The admin session is kept between polls so the
  admin login's rate limit is not hit.
- The config file is watched too; a change reloads it and re-plans what is
  watched, and a config that no longer loads keeps the previous one running.
- A file is rewritten only when its contents change, so an unchanged schema
  never touches it.
- Ctrl-C (SIGINT) and SIGTERM close every watcher and timer. `--watch` cannot be
  combined with `--check`.

`GenerateConfig` gains an optional `watch: { interval }`, exported as
`WatchGeneration`.

Also fixes `.json` configs, which failed under plain Node because JSON cannot be
imported without an import attribute; they are now read and parsed directly.
