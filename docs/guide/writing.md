# Writing

Strapi takes relations and media **by reference** — a `documentId`, a numeric `id`, or the `connect` / `disconnect` / `set` longhand — while components and dynamic zones are written inline. Generated types carry a `__relations` marker so the payload is checked the same way:

```ts
await articles.create({
	payload: {
		data: {
			title: "Hello",
			author: "author-document-id",
			tags: ["tag-1", "tag-2"],
			cover: { id: 7 },
			seo: { metaTitle: "Hello" },
			blocks: [{ __component: "blocks.hero", title: "Hello" }],
		},
	},
});

await articles.update({
	documentId,
	payload: {
		data: {
			tags: {
				connect: [{ documentId: "tag-3", position: { end: true } }],
				disconnect: ["tag-1"],
			},
		},
	},
});

await articles.create({ payload: { data: { author: { name: "Ada" } } } });
// error: a relation takes a reference, not the related document
```

A reference is a `documentId` string, an `id` number, or the longhand `{ documentId, locale?, status?, position? }` / `{ id, position? }`. To-many fields take a list of them; to-one fields take one, or `null` to clear. `position` orders a connected relation: `{ before }`, `{ after }`, `{ start: true }` or `{ end: true }`.

`connect`, `disconnect` and `set` accept either a single reference or a list. `set` replaces the relation.

Components and dynamic zones are nested objects, recursively partial. A dynamic-zone entry needs `__component` so Strapi knows which component it is. The generator puts that field on the union.

`params` on a write (`fields`, `populate`, `locale`, `status`) shape the document that comes back. They do not choose which document is written. `update` and `delete` take `documentId` for that.

Types written by hand, with no `__relations` marker, keep a `DeepPartial<T>` payload.

Users and uploads do not use this payload shape. See [Users](/guide/users) and [Uploads](/guide/uploads).
