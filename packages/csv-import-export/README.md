# @fbritoferreira/strapi-csv-import-export

Strapi 5 plugin to import and export collection types as CSV from the admin panel.

- Map CSV columns to fields, with automatic mapping by name and reuse of the last mapping for the same columns
- Upsert on `documentId` or any unique field, so re-importing a file updates instead of duplicating
- Link relations by any field of the related collection (`slug`, `label`, `documentId`), with `|` for to-many
- Dry-run preview, batched imports with progress, and a downloadable file of failed rows
- Export with chosen columns and headers, relation values and formula-injection escaping
- History of every import and export
- Content Manager permissions enforced per collection

```bash
npm install @fbritoferreira/strapi-csv-import-export
```

Install it from npm. The [JSR package](https://jsr.io/@fbritoferreira/strapi-csv-import-export) holds the TypeScript source and API docs, not the built `dist/` server and admin bundles that Strapi loads.

```typescript
// config/plugins.ts
export default () => ({
  'csv-import-export': { enabled: true },
});
```

Full documentation: https://strapi.fbritoferreira.com/packages/csv-import-export/
