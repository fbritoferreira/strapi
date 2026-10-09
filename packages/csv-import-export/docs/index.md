---
title: CSV Import / Export
description: Strapi 5 plugin to import and export collection types as CSV with column mapping, relation linking and upsert
---

# CSV Import / Export

Strapi 5 plugin that imports CSV files into any collection type and exports collection types as CSV, from the admin panel. Imports upsert: a row whose match value already exists updates that entry, so importing the same file twice creates nothing the second time.

## Installation

```bash
npm install @fbritoferreira/strapi-csv-import-export
# or
pnpm add @fbritoferreira/strapi-csv-import-export
```

Requires Strapi 5 and Node.js `^20.19.0 || >=22.12.0`.

Enable it and rebuild the admin panel:

```typescript
// config/plugins.ts
export default () => ({
  'csv-import-export': {
    enabled: true,
  },
});
```

```bash
npm run build
```

## Permissions

The plugin adds two actions under **Settings → Roles → Plugins → CSV Import / Export**: *Import CSV* and *Export CSV*. Super Admins have both.

On top of those, every request checks the Content Manager permissions of the collection it touches:

| Operation | Content Manager permissions needed |
| --- | --- |
| Import as draft | create, update |
| Import as published | create, update, publish |
| Export, history, schema | read |

The checks follow the role's limits in detail:

- **Fields.** Every mapped column needs the permission on that field, and every exported column needs read on it. A role that may update only `title` cannot import a `price` column.
- **Locales.** The import or export locale must be one the role may use. Without a locale the default locale applies.
- **Relations.** Linking or exporting a relation by a field of the related collection, such as `category.slug`, needs read permission on that field of the related collection.
- **Entry conditions.** Rules limited by a condition on the entry itself, such as "is creator", are refused: a bulk import or export cannot apply them row by row.

Private attributes (`private: true` in the schema, such as users-permissions' reset tokens) are never imported, exported or used to match relations. The History tab only lists jobs for collections the user can read.

## Importing

Open **CSV Import / Export** in the main menu, or use **Import CSV** in a collection's list view to preselect it.

1. **Source.** Choose the collection, the locale (localized collections only) and whether entries are saved as draft or published (Draft & Publish collections only). Pick the file.
2. **Mapping.** Each CSV column maps to a field or is ignored. Columns whose header matches a field name are mapped automatically, ignoring case, spaces, `_` and `-`. If an earlier import of the same collection had the same set of columns, its whole mapping is reused.
3. **Preview.** A dry run of the first 100 rows shows what each row will do (create, update, skip, error) without writing anything.
4. **Run.** Rows are sent in batches of 100. A progress bar and live counts show the result. Rows that failed or were skipped can be downloaded as a CSV with the row number and the reason, fixed and imported again. A batch whose request fails is not retried automatically, because it may have been written before the connection dropped; importing the file again updates the rows that match.

### How existing entries are matched

**Find existing entries by** chooses the field that identifies a row: `documentId` or any unique field (`uid` fields such as `slug`, or fields marked unique).

| Match cell | Existing entries with that value | Result |
| --- | --- | --- |
| empty | n/a | create |
| `news` | none | create |
| `news` | one | update that entry |
| `news` | more than one | error, nothing written |

Values are trimmed and compared as text. Two rows with the same value in one file create the entry once and then update it. For localized collections, matching on a field other than `documentId` only looks at entries in the chosen locale. Matching on `documentId` finds the document in any locale, so importing a translation of an exported file adds that locale to the existing document.

An empty cell clears the field. Leave a column unmapped to keep the current value.

### Relations

A relation column holds values of a field on the related collection, for example a category `slug`. Choose that field under **Relation matches on**. To-many relations take several values separated by `|`:

```csv
slug,title,category,tags
csv-import,CSV import,sport,csv|typescript
```

The relation is replaced with exactly the listed entries, and an empty cell removes all of them. The plugin never creates related entries. When a value matches no entry, **Missing relation** decides what happens:

- **Skip the row**: the row is not written and is listed with the failed rows.
- **Stop the import**: nothing in that batch of 100 rows is written and the import stops. Earlier batches stay imported.

Media fields take the URL or the file name of a file already in the Media Library.

### Field formats

| Type | Accepted values |
| --- | --- |
| integer, big integer | `-42` |
| float, decimal | `3.5` |
| boolean | `true`/`false`, `1`/`0`, `yes`/`no`, `y`/`n`, any case |
| date | `2026-10-09` |
| datetime | anything `Date.parse` reads, stored as ISO 8601 UTC |
| time | `09:30`, `09:30:15`, `09:30:15.5` |
| enumeration | one of the enum values, exact case |
| json, blocks | JSON text |

Components, dynamic zones, passwords and polymorphic relations are not imported or exported.

## Exporting

Choose the collection, locale and draft or published version. Every scalar field and `documentId` is selected by default. Relations and media are off until you tick them. Each column has an editable header and can be moved up or down. A relation column writes the chosen field of each related entry, joined with `|`. Media columns write the file URL.

The file is UTF-8 with a byte order mark, so Excel opens accented characters correctly. Cells that start with `=`, `+`, `-`, `@`, a tab or a carriage return are prefixed with `'` so spreadsheet programs do not run them as formulas ([OWASP CSV injection](https://owasp.org/www-community/attacks/CSV_Injection)). Numbers are not prefixed.

On import, a leading `'` before one of those characters is removed again, so an export re-imports unchanged. An export that includes `documentId` can be imported back with **Find existing entries by: documentId**, which updates every row in place.

## History

Every import and export is recorded with the collection, file name, user, state and counts. **Details** shows the mapping that was used and the failed rows, and downloads them as CSV. Only failed and skipped rows are stored, never the rows that succeeded.

An import whose browser tab was closed before it finished stays `running`.

## Configuration

```typescript
// config/plugins.ts
export default () => ({
  'csv-import-export': {
    enabled: true,
    config: {
      // Prefix formula-looking cells in exports with '. Default true.
      escapeFormulas: true,
      // Largest CSV the import screen accepts, in MB. Default 10.
      maxFileSizeMb: 10,
    },
  },
});
```

Each import batch is one JSON request of up to 100 rows. Strapi's body parser limits JSON bodies to 1 MB by default. If rows are very wide, raise `jsonLimit` for `strapi::body` in `config/middlewares.ts`.

See the [admin API reference](./api) to drive imports and exports from scripts.
