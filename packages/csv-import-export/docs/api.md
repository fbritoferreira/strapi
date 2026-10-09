---
title: Admin API
description: HTTP routes of the CSV import/export plugin
---

# Admin API

The admin panel uses these routes, and scripts can call them with an admin JWT. Every route needs an authenticated admin and the Content Manager permissions listed in [Permissions](./#permissions), checked per field, locale and relation target. A missing permission returns `403` with the action, collection, fields and locale in the message. All paths are under `/csv-import-export`.

```bash
TOKEN=$(curl -s -X POST localhost:1337/admin/login -H 'content-type: application/json' \
  -d '{"email":"admin@example.com","password":"..."}' | jq -r .data.token)
```

## Collections and fields

`GET /content-types` lists the collection types the user can read:

```json
{
  "data": [{ "uid": "api::article.article", "displayName": "Article", "draftAndPublish": true, "localized": false }],
  "meta": { "maxFileSizeMb": 10 }
}
```

`GET /content-types/:uid/schema` lists the fields an import can map to, `documentId` first:

```json
{
  "data": [
    { "name": "documentId", "type": "string", "required": false, "unique": true },
    { "name": "slug", "type": "uid", "required": false, "unique": true },
    { "name": "category", "type": "relation", "required": false, "unique": false,
      "relation": { "target": "api::category.category", "multiple": false } }
  ]
}
```

## Importing

An import is a job plus one request per batch of at most 500 rows (the admin panel sends 100).

`POST /jobs` starts an import job. Needs the *Import CSV* plugin permission.

```json
{ "uid": "api::article.article", "status": "published", "fileName": "articles.csv", "totalRows": 2, "config": {} }
```

Returns `201` with `{ "data": { "id": 12, "state": "running", ... } }`. `config` is stored as-is; the admin panel saves the mapping there to reuse it.

`POST /import/:uid` imports one batch:

```json
{
  "status": "published",
  "locale": "en",
  "matchField": "slug",
  "mapping": { "Slug": "slug", "Title": "title", "Category": "category" },
  "relations": { "category": { "matchOn": "slug" } },
  "onMissingRelation": "skip",
  "dryRun": false,
  "jobId": 12,
  "rowOffset": 0,
  "rows": [
    { "Slug": "csv-import", "Title": "CSV import", "Category": "sport" },
    { "Slug": "other", "Title": "Other", "Category": "cooking" }
  ]
}
```

| Field | Meaning |
| --- | --- |
| `mapping` | CSV column to field name. Unlisted columns are ignored. |
| `matchField` | `documentId` or a unique field, and it must be mapped. |
| `relations` | For each mapped relation, the target field the cells hold. |
| `onMissingRelation` | `skip` the row, or `fail` the whole batch without writing any of it. |
| `rowOffset` | Rows sent in earlier batches. Result row numbers are `rowOffset + index + 1`. |
| `dryRun` | Decide every action without writing, and leave the job alone. |
| `jobId` | Required unless `dryRun` is `true`: a running import job for this collection that the caller started. The batch counts and failed rows are added to it. |

```json
{
  "data": {
    "aborted": false,
    "results": [
      { "row": 1, "action": "created", "documentId": "a34anq3a3y9vfjfluz2tewkg" },
      { "row": 2, "action": "skipped", "error": "category: no entry with slug \"cooking\"" }
    ]
  }
}
```

`action` is `created`, `updated`, `skipped` or `error`. `aborted` is `true` when `onMissingRelation` is `fail` and a target was missing; every row then has action `error` and nothing in the batch was written.

`POST /jobs/:id/finish` with `{ "state": "completed" }` or `{ "state": "failed" }` closes the job. Only the admin who started it can finish it.

## Exporting

`POST /export/:uid` needs the *Export CSV* plugin permission.

```json
{
  "status": "published",
  "locale": "en",
  "fileName": "articles.csv",
  "columns": [
    { "field": "documentId", "header": "id" },
    { "field": "category", "header": "category", "matchOn": "slug" }
  ]
}
```

The response is JSON, not a file, because the admin panel's fetch client only reads JSON responses:

```json
{ "data": { "fileName": "articles.csv", "rowCount": 2, "csv": "id,category\r\n..." } }
```

## History

`GET /jobs?page=1&pageSize=20&uid=api::article.article&kind=import` lists jobs newest first, without their failed rows. `pageSize` is capped at 100.

`GET /jobs/:id` returns one job, including `errors`: `[{ "row": 2, "data": { ...the CSV row... }, "message": "..." }]`.
