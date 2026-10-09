import Papa from 'papaparse';

import type { FieldDescription, RelationSetting } from '../../../server/src/types';

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

export interface Failure {
  row: number;
  data?: Record<string, string>;
  message: string;
}

/** Parses a whole CSV file in the browser. Papaparse strips a UTF-8 BOM. */
export const parseCsv = (text: string): ParsedCsv | { error: string } => {
  const result = Papa.parse<string[]>(text, { skipEmptyLines: 'greedy' });
  const [rawHeaders = [], ...records] = result.data;
  const headers = rawHeaders.map((header) => header.trim());

  const blank = headers.findIndex((header) => header === '');
  if (blank !== -1) return { error: `column ${blank + 1} has no header` };
  const duplicate = headers.find((header, i) => headers.indexOf(header) !== i);
  if (duplicate) return { error: `column "${duplicate}" appears more than once` };
  if (records.length === 0) return { error: 'the file has no data rows' };

  const rows: Record<string, string>[] = [];
  for (const [i, record] of records.entries()) {
    if (record.length > headers.length) return { error: `row ${i + 1} has more cells than there are columns` };
    rows.push(Object.fromEntries(headers.map((header, j) => [header, record[j] ?? ''])));
  }
  return { headers, rows };
};

const normalise = (value: string) => value.toLowerCase().replace(/[\s_-]/g, '');

/** CSV column -> field name ('' means ignored), matching names loosely, each field at most once. */
export const autoMap = (headers: string[], fields: FieldDescription[]): Record<string, string> => {
  const used = new Set<string>();
  return Object.fromEntries(
    headers.map((header) => {
      const field = fields.find((f) => !used.has(f.name) && normalise(f.name) === normalise(header));
      if (field) used.add(field.name);
      return [header, field?.name ?? ''];
    })
  );
};

/** The target field a relation column most likely holds: a unique field such as slug, else documentId. */
export const defaultMatchOn = (targetFields: FieldDescription[]) =>
  targetFields.find((f) => f.unique && f.name !== 'documentId' && f.type !== 'relation' && f.type !== 'media')
    ?.name ?? 'documentId';

export const mappingProblems = (
  fields: FieldDescription[],
  {
    mapping,
    matchField,
    relations,
  }: { mapping: Record<string, string>; matchField: string; relations: Record<string, RelationSetting> }
) => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const mapped = Object.entries(mapping).filter(([, name]) => name !== '');
  const names = mapped.map(([, name]) => name);

  if (!names.includes(matchField)) {
    errors.push(`Map a column to ${matchField}, the field used to find existing entries.`);
  }
  for (const name of new Set(names.filter((name, i) => names.indexOf(name) !== i))) {
    errors.push(`${name} is mapped from more than one column.`);
  }
  for (const [column, name] of mapped) {
    const field = fields.find((f) => f.name === name);
    if (field?.type === 'relation' && !relations[name]?.matchOn) {
      errors.push(`Choose which ${name} field the ${column} column matches.`);
    }
  }
  // Not an error: an upsert that only touches a few columns is a normal use.
  for (const field of fields) {
    if (field.required && !names.includes(field.name)) {
      warnings.push(`${field.name} is required: rows that create new entries will fail without it.`);
    }
  }
  return { errors, warnings };
};

export const sameHeaders = (a: string[], b: string[]) =>
  a.length === b.length && [...a].sort().join('\u0000') === [...b].sort().join('\u0000');

export const chunk = <T,>(items: T[], size: number): T[][] => {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) batches.push(items.slice(i, i + size));
  return batches;
};

/** Same prefixes the server escapes on export (OWASP CSV injection). */
const FORMULA_PATTERN = /^[=+\-@\t\r]/;

/** Failed rows as CSV; formula-looking cells get a leading ', which the import strips again. */
export const failuresToCsv = (headers: string[], failures: Failure[]) =>
  Papa.unparse(
    {
      fields: ['row', 'error', ...headers],
      data: failures.map((f) => [f.row, f.message, ...headers.map((h) => f.data?.[h] ?? '')]),
    },
    { escapeFormulae: FORMULA_PATTERN }
  );

/** Saves text as a file. The BOM makes Excel read the CSV as UTF-8. */
export const download = (fileName: string, text: string) => {
  const url = URL.createObjectURL(new Blob(['﻿', text], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};
