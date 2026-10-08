# Uploads

`strapi.files` is the upload plugin at `/api/upload`. Like users, these endpoints return plain objects and arrays (no `data` wrapper) and address files by numeric `id`.

| Method | Route | Notes |
| --- | --- | --- |
| `find` | `GET /api/upload/files` | `fields`, `populate`, `sort`, `pagination`, `filters`. An empty or non-array body becomes `[]`. Current Strapi 5 ignores pagination on this path and returns every file. |
| `findPage` | `GET /api/upload/files/page` | The same params. Returns one page and `meta.pagination`. |
| `findOne` | `GET /api/upload/files/<id>` | `fields`, `populate`. |
| `upload` | `POST /api/upload` | `multipart/form-data`. One `StrapiMedia` per file. |
| `update` | `POST /api/upload?id=<id>` | Metadata only. Does not re-upload the file. |
| `delete` | `DELETE /api/upload/files/<id>` | Returns the deleted media entry. |

`status`, `locale` and `_q` are not part of these routes.

```ts
const [err, page, meta] = await strapi.files.findPage({
	params: { pagination: { page: 1, pageSize: 20 }, filters: { mime: { $startsWith: "image" } } },
});
```

## Uploading

```ts
const [err, uploaded] = await strapi.files.upload({
	files: file,
	fileInfo: { alternativeText: "Cover", caption: "Hero" },
});
```

`files` is one `Blob` or an array. A `File` keeps its name. A plain `Blob` is named `file-0`, `file-1`, … unless you pass `fileName` (a string, or one entry per file).

`fileInfo` is metadata. Pass one object, or an array in the same order as `files`. Each entry is appended as a JSON string, which is what the plugin expects.

To attach the upload to a media field in the same request, pass the content-type uid, the entry id Strapi's upload route calls `refId`, and the field name. The client forwards `refId` as a string; the type accepts `string | number`.

```ts
const [err, uploaded] = await strapi.files.upload({
	files: file,
	ref: "api::article.article",
	refId: documentId,
	field: "cover",
});
```

## Metadata and deletion

```ts
const [err, file] = await strapi.files.findOne({ id: 7, params: { fields: ["url", "name"] } });

await strapi.files.update({
	id: 7,
	fileInfo: { name: "cover.jpg", alternativeText: "Cover" },
});

await strapi.files.delete({ id: 7 });
```

`FileInfo` accepts `name`, `alternativeText` and `caption`, all optional.

## What a file looks like

`StrapiMedia` extends `StrapiDocument` (`id`, `documentId`, `createdAt`, `updatedAt`, `publishedAt`, optional `locale`) with `name`, `alternativeText`, `caption`, `width`, `height`, `formats`, `hash`, `ext`, `mime`, `size`, `url`, `previewUrl`, `provider` and `provider_metadata`. `formats` is a map of generated sizes (`thumbnail`, `small`, `medium`, `large`), or `null`. `focalPoint` and `related` are present only when the instance sends them.

Media on a content type is still written by reference (`documentId` or `id`), not by uploading inline. See [Writing](./writing).
