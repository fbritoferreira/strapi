import type { FieldDescription } from '../types';

export interface CollectionTypeSummary {
  uid: string;
  displayName: string;
  draftAndPublish: boolean;
  localized: boolean;
}

/** Managed by Strapi itself; never mapped from a CSV column. documentId is added back as a pseudo-field. */
const SYSTEM_FIELDS = new Set([
  'id',
  'documentId',
  'createdAt',
  'updatedAt',
  'publishedAt',
  'createdBy',
  'updatedBy',
  'locale',
  'localizations',
]);
// ponytail: components and dynamic zones are out of scope for v1 (see spec); password is never imported.
const UNSUPPORTED_TYPES = new Set(['component', 'dynamiczone', 'password']);
const SINGLE_RELATIONS = new Set(['oneToOne', 'manyToOne', 'oneWay']);
const MULTI_RELATIONS = new Set(['oneToMany', 'manyToMany', 'manyWay']);

const DOCUMENT_ID: FieldDescription = { name: 'documentId', type: 'string', required: false, unique: true };

/** Same visibility rule the Content Manager uses, limited to collection types. */
export const isImportable = (contentType: any): boolean =>
  contentType?.kind === 'collectionType' &&
  !contentType.uid.startsWith('admin::') &&
  contentType.pluginOptions?.['content-manager']?.visible !== false;

const describeAttribute = (name: string, attribute: any): FieldDescription | null => {
  if (SYSTEM_FIELDS.has(name) || UNSUPPORTED_TYPES.has(attribute.type)) return null;
  // Private attributes (reset tokens, internal notes) never leave the server through the REST API either.
  if (attribute.private === true) return null;

  const base: FieldDescription = {
    name,
    type: attribute.type,
    required: attribute.required === true,
    unique: attribute.unique === true || attribute.type === 'uid',
  };

  if (attribute.type === 'relation') {
    const multiple = MULTI_RELATIONS.has(attribute.relation);
    if (!multiple && !SINGLE_RELATIONS.has(attribute.relation)) return null; // morph relations
    if (String(attribute.target).startsWith('admin::')) return null;
    return { ...base, relation: { target: attribute.target, multiple } };
  }
  if (attribute.type === 'enumeration') return { ...base, enum: attribute.enum };
  if (attribute.type === 'media') return { ...base, multiple: attribute.multiple === true };
  return base;
};

export const describe = (strapi: any, uid: string): FieldDescription[] | null => {
  const contentType = strapi.contentTypes[uid];
  if (!isImportable(contentType)) return null;

  const fields = Object.entries<any>(contentType.attributes)
    .map(([name, attribute]) => describeAttribute(name, attribute))
    .filter((field): field is FieldDescription => field !== null);

  return [DOCUMENT_ID, ...fields];
};

export const listCollectionTypes = (strapi: any, canRead: (uid: string) => boolean): CollectionTypeSummary[] =>
  Object.values<any>(strapi.contentTypes)
    .filter((contentType) => isImportable(contentType) && canRead(contentType.uid))
    .map((contentType) => ({
      uid: contentType.uid,
      displayName: contentType.info.displayName,
      draftAndPublish: contentType.options?.draftAndPublish === true,
      localized: contentType.pluginOptions?.i18n?.localized === true,
    }));
