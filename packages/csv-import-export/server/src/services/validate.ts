import type { FieldDescription, PublicationStatus } from '../types';

export const MAX_BATCH_ROWS = 500;

type FieldsOf = (uid: string) => FieldDescription[] | null;

export const isStatus = (value: unknown): value is PublicationStatus => value === 'draft' || value === 'published';

const isPlainObject = (value: unknown): value is Record<string, any> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A relation can match on any non-relation, non-media field of its target, documentId included. */
const checkMatchOn = (field: FieldDescription, matchOn: unknown, fieldsOf: FieldsOf): string | null => {
  if (typeof matchOn !== 'string' || matchOn === '') return `relation "${field.name}" needs a matchOn field`;
  const target = fieldsOf(field.relation!.target) ?? [];
  const ok = target.some((f) => f.name === matchOn && f.type !== 'relation' && f.type !== 'media');
  return ok ? null : `relation "${field.name}" cannot match on "${matchOn}"`;
};

export const validateImportRequest = (fields: FieldDescription[], body: any, fieldsOf: FieldsOf): string | null => {
  if (!isPlainObject(body)) return 'body must be an object';
  if (!isStatus(body.status)) return 'status must be "draft" or "published"';
  if (body.onMissingRelation !== 'skip' && body.onMissingRelation !== 'fail') {
    return 'onMissingRelation must be "skip" or "fail"';
  }
  if (!Array.isArray(body.rows) || body.rows.length === 0) return 'rows must be a non-empty array';
  if (body.rows.length > MAX_BATCH_ROWS) return `a batch holds at most ${MAX_BATCH_ROWS} rows`;
  if (!body.rows.every((row: unknown) => isPlainObject(row) && Object.values(row).every((v) => typeof v === 'string'))) {
    return 'every row must be an object of strings';
  }
  if (!Number.isInteger(body.rowOffset) || body.rowOffset < 0) return 'rowOffset must be a non-negative integer';
  if (body.dryRun !== true && !Number.isInteger(body.jobId)) return 'jobId is required unless dryRun is true';
  if (!isPlainObject(body.mapping)) return 'mapping must be an object';

  const byName = new Map(fields.map((field) => [field.name, field]));
  if (!byName.get(body.matchField)?.unique) {
    return `matchField "${body.matchField}" must be documentId or a unique field`;
  }

  const seen = new Set<string>();
  for (const name of Object.values(body.mapping)) {
    const field = byName.get(name as string);
    if (!field) return `unknown field "${name}"`;
    if (seen.has(field.name)) return `field "${field.name}" is mapped more than once`;
    seen.add(field.name);
    if (field.type === 'relation') {
      const error = checkMatchOn(field, body.relations?.[field.name]?.matchOn, fieldsOf);
      if (error) return error;
    }
  }
  if (!seen.has(body.matchField)) return `matchField "${body.matchField}" is not mapped to a column`;

  return null;
};

export const validateExportRequest = (fields: FieldDescription[], body: any, fieldsOf: FieldsOf): string | null => {
  if (!isPlainObject(body)) return 'body must be an object';
  if (!isStatus(body.status)) return 'status must be "draft" or "published"';
  if (!Array.isArray(body.columns) || body.columns.length === 0) return 'columns must be a non-empty array';

  const byName = new Map(fields.map((field) => [field.name, field]));
  for (const column of body.columns) {
    const field = byName.get(column?.field);
    if (!field) return `unknown field "${column?.field}"`;
    if (typeof column.header !== 'string' || column.header === '') return `column "${field.name}" needs a header`;
    if (field.type === 'relation') {
      const error = checkMatchOn(field, column.matchOn ?? 'documentId', fieldsOf);
      if (error) return error;
    }
  }
  return null;
};
