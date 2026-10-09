import type { FieldDescription } from '../types';
import { splitMulti } from './coerce';

export type LookupIndex = Map<string, Array<string | number>>;

const add = (index: LookupIndex, key: unknown, id: string | number) => {
  if (key === null || key === undefined) return;
  const ids = index.get(String(key)) ?? [];
  if (!ids.includes(id)) ids.push(id);
  index.set(String(key), ids);
};

/**
 * One query per relation (or media) column per batch, not one per row.
 * ponytail: relation targets are matched in their default locale and draft
 * version; documentId matching is locale-independent. Match per locale if
 * users import translated targets by name.
 */
export const loadIndex = async (
  strapi: any,
  field: FieldDescription,
  matchOn: string | undefined,
  values: string[]
): Promise<LookupIndex> => {
  const index: LookupIndex = new Map();

  if (field.type === 'media') {
    const files = await strapi.db.query('plugin::upload.file').findMany({
      where: { $or: [{ url: { $in: values } }, { name: { $in: values } }] },
      select: ['id', 'url', 'name'],
    });
    for (const file of files) {
      add(index, file.url, file.id);
      add(index, file.name, file.id);
    }
    return index;
  }

  const key = matchOn ?? 'documentId';
  const docs = await strapi.documents(field.relation!.target).findMany({
    filters: { [key]: { $in: values } },
    fields: [key],
  });
  for (const doc of docs) add(index, doc[key], doc.documentId);
  return index;
};

export const resolveCell = (index: LookupIndex, cell: string) => {
  const ids: Array<string | number> = [];
  const missing: string[] = [];
  const ambiguous: string[] = [];

  for (const value of splitMulti(cell)) {
    const matches = index.get(value) ?? [];
    if (matches.length === 0) missing.push(value);
    else if (matches.length > 1) ambiguous.push(value);
    else ids.push(matches[0]);
  }
  return { ids, missing, ambiguous };
};
