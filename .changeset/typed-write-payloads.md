---
"@fbritoferreira/strapi": minor
---

Type create and update payloads the way Strapi accepts them.

Relations and media are written by reference — a `documentId`, a numeric `id`,
or the `connect`/`disconnect`/`set` longhand — while components and dynamic
zones are written inline. `DeepPartial<T>` described every populatable field as
an embedded document, so the correct payload was a type error and an incorrect
one compiled:

```ts
articles.create({ payload: { data: { author: "doc-id", tags: ["t1"] } } });      // was an error
articles.create({ payload: { data: { author: { name: "Ada" } } } });             // now an error
```

`strapi-client generate` emits a `__relations` marker listing those fields, and
`WriteData<T>` reads it: to-many fields take a list of references, to-one fields
take one or `null`, both take the command object, and `position`
(`{ before }`, `{ after }`, `{ start: true }`, `{ end: true }`) orders a
connection. Components and dynamic zones stay inline and are now recursively
optional, arrays included.

`CreatePayload<T>` and `UpdatePayload<T>` carry `WriteData<T>`. Types written by
hand, with no marker, keep the previous `DeepPartial<T>` payload.
