# Single types

`strapi.single("homepage")` is a client for `/api/<uid>`. A single type holds one document per locale, so there is no list and no `documentId`.

| Method | Route | Notes |
| --- | --- | --- |
| `find` | `GET /api/<uid>` | `NotFoundError` when the single type has no document yet. |
| `update` | `PUT /api/<uid>` | Creates the document on the first call, updates it afterwards. |
| `publish` | `PUT /api/<uid>` | `{ data: {} }` and `status=published`. Same reason as collections: omitting `data` is a 400. |
| `delete` | `DELETE /api/<uid>` | The deleted document, or `null` when the body is empty. `locale` deletes only that localization. |

`find` takes `FindQueryParams` (no pagination, no `_q`). `update` and `delete` take `fields` and `populate`, which shape the returned document. The same selection narrowing as collections applies. See [Querying](/guide/querying).

```ts
interface Homepage {
	title: string;
}

const homepage = strapi.single<Homepage>("homepage");

const [err, page] = await homepage.find({ params: { populate: "*" } });

const [writeErr, saved] = await homepage.update({
	payload: { data: { title: "Welcome" } },
	locale: "fr",
});

await homepage.delete({ locale: "fr" });
```

A uid outside the generated `StrapiSingleTypes` registry needs an explicit type argument: `strapi.single<Homepage>("homepage")`.
