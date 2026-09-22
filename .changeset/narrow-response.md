---
"@fbritoferreira/strapi": minor
---

Narrow read results to what the params selected.

`findMany`, `find`, `findFirst`, `create`, `update`, `upsert` and the
single-type client now return the document as Strapi actually sends it for the
given params, exposed as `SelectedDoc<T, P>`:

- with a literal `fields`, only those attributes, plus `id` and `documentId` —
  Strapi selects `[id, documentId, ...fields]`, nothing else;
- populatable fields appear only when `populate` asks for them, and stop being
  optional when it does; `populate: "*"` covers all of them, and a dotted path
  populates its first segment.

```ts
const [, list] = await articles.findMany({ params: { fields: ["title"], populate: ["author"] } });
// { id: number; documentId: string; title: string; author: Author | null }[]
```

Narrowing needs a generated type (the `__populatable` marker) and params passed
inline. Params held in a variable, or a hand-written type with no marker, return
the full document exactly as before.

`fetchAll` takes a second type parameter so the row shape and the shape its
params are typed against can differ.
