import Papa from 'papaparse';

import type { ExportRequest, FieldDescription } from '../types';

export const PAGE_SIZE = 500;

/**
 * OWASP CSV injection prefixes. papaparse's own `escapeFormulae: true` uses
 * /^[=+\-@\t\r].*$/, which fails on cells containing a newline because `.`
 * does not match it and there is no `s` flag.
 */
export const FORMULA_PATTERN = /^[=+\-@\t\r]/;

const joinTargets = (value: any, key: string): string => {
  const items = Array.isArray(value) ? value : value ? [value] : [];
  return items
    .map((item) => item?.[key])
    .filter((v) => v !== null && v !== undefined)
    .map(String)
    .join('|');
};

const toCell = (value: unknown): unknown => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && !(value instanceof Date)) return JSON.stringify(value);
  return value;
};

/**
 * ponytail: builds the whole CSV in memory. Fine for the tens of thousands of
 * rows this plugin targets; stream page by page through a PassThrough if
 * exports start to strain server memory.
 */
export const exportCsv = async (
  strapi: any,
  uid: string,
  fields: FieldDescription[],
  request: ExportRequest,
  options: { escapeFormulas: boolean }
): Promise<{ csv: string; rowCount: number }> => {
  const contentType = strapi.contentTypes[uid];
  const draftAndPublish = contentType.options?.draftAndPublish === true;
  const localized = contentType.pluginOptions?.i18n?.localized === true;

  const byName = new Map(fields.map((field) => [field.name, field]));
  const columns = request.columns.map((column) => {
    const field = byName.get(column.field)!;
    const key = field.type === 'media' ? 'url' : field.type === 'relation' ? (column.matchOn ?? 'documentId') : null;
    return { ...column, key };
  });

  const populate = Object.fromEntries(
    columns.filter((c) => c.key !== null).map((c) => [c.field, { fields: [c.key] }])
  );

  const data: unknown[][] = [];
  for (let start = 0; ; start += PAGE_SIZE) {
    const page = await strapi.documents(uid).findMany({
      ...(localized && request.locale ? { locale: request.locale } : {}),
      ...(draftAndPublish ? { status: request.status } : {}),
      populate,
      sort: 'id:asc',
      limit: PAGE_SIZE,
      start,
    });
    for (const entry of page) {
      data.push(columns.map((c) => (c.key === null ? toCell(entry[c.field]) : joinTargets(entry[c.field], c.key))));
    }
    if (page.length < PAGE_SIZE) break;
  }

  const csv = Papa.unparse(
    { fields: columns.map((c) => c.header), data },
    { escapeFormulae: options.escapeFormulas ? FORMULA_PATTERN : false }
  );
  return { csv, rowCount: data.length };
};
