import { describe as group, expect, it } from 'vitest';

import { contentTypes } from '../test/strapi-mock';
import { describe } from './schema';
import { MAX_BATCH_ROWS, validateExportRequest, validateImportRequest } from './validate';

const strapi = { contentTypes };
const fieldsOf = (uid: string) => describe(strapi, uid);
const fields = fieldsOf('api::article.article')!;

const importBody = (overrides: Record<string, unknown> = {}) => ({
  status: 'draft',
  matchField: 'slug',
  mapping: { Title: 'title', Slug: 'slug', Category: 'category' },
  relations: { category: { matchOn: 'slug' } },
  onMissingRelation: 'skip',
  dryRun: false,
  jobId: 1,
  rowOffset: 0,
  rows: [{ Title: 'a', Slug: 'a', Category: 'news' }],
  ...overrides,
});

group('validateImportRequest', () => {
  it('accepts a well-formed request', () => {
    expect(validateImportRequest(fields, importBody(), fieldsOf)).toBeNull();
  });

  it.each([
    [{ status: 'live' }, 'status must be "draft" or "published"'],
    [{ onMissingRelation: 'create' }, 'onMissingRelation must be "skip" or "fail"'],
    [{ rows: [] }, 'rows must be a non-empty array'],
    [{ rows: Array.from({ length: MAX_BATCH_ROWS + 1 }, () => ({})) }, 'a batch holds at most 500 rows'],
    [{ rowOffset: -1 }, 'rowOffset must be a non-negative integer'],
    [{ mapping: null }, 'mapping must be an object'],
    [{ matchField: 'title' }, 'matchField "title" must be documentId or a unique field'],
    [{ mapping: { Title: 'title', Slug: 'slug', X: 'nope' } }, 'unknown field "nope"'],
    [{ mapping: { Title: 'title', Slug: 'slug', Other: 'slug' } }, 'field "slug" is mapped more than once'],
    [{ mapping: { Title: 'title' } }, 'matchField "slug" is not mapped to a column'],
    [{ relations: {} }, 'relation "category" needs a matchOn field'],
    [{ relations: { category: { matchOn: 'colour' } } }, 'relation "category" cannot match on "colour"'],
    [{ rows: ['not a row'] }, 'every row must be an object of strings'],
    [{ jobId: undefined }, 'jobId is required unless dryRun is true'],
  ])('rejects %j', (overrides, message) => {
    expect(validateImportRequest(fields, importBody(overrides), fieldsOf)).toBe(message);
  });

  it('accepts documentId as match field and as relation matchOn', () => {
    expect(
      validateImportRequest(
        fields,
        importBody({
          matchField: 'documentId',
          mapping: { Id: 'documentId', Category: 'category' },
          relations: { category: { matchOn: 'documentId' } },
        }),
        fieldsOf
      )
    ).toBeNull();
  });

  it('does not need a jobId for a dry run', () => {
    expect(validateImportRequest(fields, importBody({ jobId: undefined, dryRun: true }), fieldsOf)).toBeNull();
  });

  it('rejects private attributes as relation match fields', () => {
    const withPrivate = { ...contentTypes };
    withPrivate['api::category.category'] = {
      ...contentTypes['api::category.category'],
      attributes: { ...contentTypes['api::category.category'].attributes, token: { type: 'string', private: true } },
    };
    const of = (uid: string) => describe({ contentTypes: withPrivate }, uid);
    expect(
      validateImportRequest(fields, importBody({ relations: { category: { matchOn: 'token' } } }), of)
    ).toBe('relation "category" cannot match on "token"');
  });

  it('does not need matchOn for media columns', () => {
    expect(
      validateImportRequest(fields, importBody({ mapping: { Slug: 'slug', Cover: 'cover' }, relations: {} }), fieldsOf)
    ).toBeNull();
  });
});

group('validateExportRequest', () => {
  const exportBody = (overrides: Record<string, unknown> = {}) => ({
    status: 'published',
    columns: [
      { field: 'documentId', header: 'id' },
      { field: 'category', header: 'category', matchOn: 'slug' },
    ],
    ...overrides,
  });

  it('accepts a well-formed request', () => {
    expect(validateExportRequest(fields, exportBody(), fieldsOf)).toBeNull();
  });

  it.each([
    [{ status: 'x' }, 'status must be "draft" or "published"'],
    [{ columns: [] }, 'columns must be a non-empty array'],
    [{ columns: [{ field: 'nope', header: 'n' }] }, 'unknown field "nope"'],
    [{ columns: [{ field: 'title', header: '' }] }, 'column "title" needs a header'],
    [{ columns: [{ field: 'category', header: 'c', matchOn: 'colour' }] }, 'relation "category" cannot match on "colour"'],
  ])('rejects %j', (overrides, message) => {
    expect(validateExportRequest(fields, exportBody(overrides), fieldsOf)).toBe(message);
  });
});
