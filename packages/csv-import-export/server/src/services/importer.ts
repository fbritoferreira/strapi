import type { FieldDescription, ImportRequest, ImportResult, RowResult } from '../types';
import { coerce, splitMulti } from './coerce';
import { type LookupIndex, loadIndex, resolveCell } from './relations';

interface PreparedRow {
  row: number;
  key: string;
  data: Record<string, unknown>;
}

type Prepared = PreparedRow | (RowResult & { missingTarget?: boolean });

const isPrepared = (value: Prepared): value is PreparedRow => 'data' in value;

const errorMessage = (error: any): string => {
  const details = error?.details?.errors;
  if (Array.isArray(details) && details.length > 0) {
    return details.map((d: any) => `${(d.path ?? []).join('.')}: ${d.message}`).join('; ');
  }
  return error?.message ?? String(error);
};

const prepareRow = (
  cells: Record<string, string>,
  row: number,
  columns: Array<{ column: string; field: FieldDescription }>,
  request: ImportRequest,
  indexes: Map<string, LookupIndex>
): Prepared => {
  const data: Record<string, unknown> = {};
  let key = '';

  for (const { column, field } of columns) {
    const cell = cells[column] ?? '';
    if (field.name === request.matchField) key = cell.trim();
    if (field.name === 'documentId') continue;

    if (field.type === 'relation' || field.type === 'media') {
      const { ids, missing, ambiguous } = resolveCell(indexes.get(field.name)!, cell);
      const matchOn = field.type === 'media' ? 'url or name' : request.relations[field.name].matchOn;
      if (ambiguous.length > 0) {
        return { row, action: 'error', error: `${field.name}: ${matchOn} "${ambiguous[0]}" matches more than one entry` };
      }
      if (missing.length > 0) {
        return {
          row,
          action: 'skipped',
          missingTarget: true,
          error: `${field.name}: no entry with ${matchOn} "${missing[0]}"`,
        };
      }
      if (field.type === 'relation') data[field.name] = { set: ids };
      else data[field.name] = field.multiple ? ids : (ids[0] ?? null);
      continue;
    }

    const coerced = coerce(field, cell);
    if ('error' in coerced) return { row, action: 'error', error: `${field.name}: ${coerced.error}` };
    data[field.name] = coerced.value;
  }

  return { row, key, data };
};

/** Upserts one batch of CSV rows. `request` must already have passed validateImportRequest. */
export const importBatch = async (
  strapi: any,
  uid: string,
  fields: FieldDescription[],
  request: ImportRequest
): Promise<ImportResult> => {
  const contentType = strapi.contentTypes[uid];
  const draftAndPublish = contentType.options?.draftAndPublish === true;
  const localized = contentType.pluginOptions?.i18n?.localized === true;
  const scope = localized && request.locale ? { locale: request.locale } : {};

  const byName = new Map(fields.map((field) => [field.name, field]));
  const columns = Object.entries(request.mapping).map(([column, name]) => ({ column, field: byName.get(name)! }));

  const indexes = new Map<string, LookupIndex>();
  for (const { column, field } of columns) {
    if (field.type !== 'relation' && field.type !== 'media') continue;
    const values = [...new Set(request.rows.flatMap((cells) => splitMulti(cells[column] ?? '')))];
    indexes.set(
      field.name,
      values.length > 0 ? await loadIndex(strapi, field, request.relations[field.name]?.matchOn, values) : new Map()
    );
  }

  const prepared = request.rows.map((cells, i) =>
    prepareRow(cells, request.rowOffset + i + 1, columns, request, indexes)
  );

  if (request.onMissingRelation === 'fail' && prepared.some((p) => !isPrepared(p) && p.missingTarget)) {
    return {
      aborted: true,
      results: prepared.map((p) => ({
        row: p.row,
        action: 'error',
        error: isPrepared(p) ? 'not written: a relation target is missing in this batch' : p.error,
      })),
    };
  }

  // Query Engine, not the Document Service: one query sees every locale and both
  // draft and published rows, so a documentId match finds documents that do not
  // have the target locale yet (update then creates that locale).
  const keys = [...new Set(prepared.filter(isPrepared).map((p) => p.key).filter(Boolean))];
  const existing = new Map<string, string[]>();
  if (keys.length > 0) {
    const where: Record<string, unknown> = { [request.matchField]: { $in: keys } };
    if (localized && request.locale && request.matchField !== 'documentId') where.locale = request.locale;
    const select = [...new Set(['documentId', request.matchField])];
    for (const entry of await strapi.db.query(uid).findMany({ where, select })) {
      const key = String(entry[request.matchField]);
      const ids = existing.get(key) ?? [];
      if (!ids.includes(entry.documentId)) ids.push(entry.documentId);
      existing.set(key, ids);
    }
  }

  const documents = strapi.documents(uid);
  const results: RowResult[] = [];

  for (const p of prepared) {
    if (!isPrepared(p)) {
      results.push({ row: p.row, action: p.action, error: p.error });
      continue;
    }

    const matches = p.key ? (existing.get(p.key) ?? []) : [];
    if (matches.length > 1) {
      results.push({
        row: p.row,
        action: 'error',
        error: `ambiguous match: ${request.matchField} "${p.key}" matches ${matches.length} entries`,
      });
      continue;
    }

    const action = matches.length === 1 ? 'updated' : 'created';

    if (request.dryRun) {
      if (p.key) existing.set(p.key, [matches[0] ?? `dry-run:${p.key}`]);
      results.push({ row: p.row, action, ...(matches[0] ? { documentId: matches[0] } : {}) });
      continue;
    }

    try {
      const written =
        action === 'updated'
          ? await documents.update({ documentId: matches[0], ...scope, data: p.data })
          : await documents.create({ ...scope, data: p.data });
      if (draftAndPublish && request.status === 'published') {
        await documents.publish({ documentId: written.documentId, ...scope });
      }
      if (p.key) existing.set(p.key, [written.documentId]);
      results.push({ row: p.row, action, documentId: written.documentId });
    } catch (error) {
      results.push({ row: p.row, action: 'error', error: errorMessage(error) });
    }
  }

  return { aborted: false, results };
};
