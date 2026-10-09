import { describe as group, expect, it, vi } from 'vitest';

import type { ImportRequest } from '../types';
import { contentTypes } from '../test/strapi-mock';
import { importBatch } from './importer';
import { describe } from './schema';

const ARTICLE = 'api::article.article';
const CATEGORY = 'api::category.category';

/** In-memory Strapi: `existing` rows are what db.query sees, documents() records writes. */
const makeStrapi = ({
  existing = [] as any[],
  categories = [] as any[],
  files = [] as any[],
  failCreate = null as any,
} = {}) => {
  let next = 1;
  const writes: any[] = [];
  const document = (uid: string) => ({
    findMany: vi.fn(async ({ filters }: any) => {
      const [key, condition] = Object.entries<any>(filters)[0];
      return (uid === CATEGORY ? categories : []).filter((c) => condition.$in.includes(String(c[key])));
    }),
    create: vi.fn(async (params: any) => {
      if (failCreate) throw failCreate;
      const documentId = `new-${next++}`;
      writes.push({ op: 'create', uid, ...params, documentId });
      return { documentId };
    }),
    update: vi.fn(async (params: any) => {
      writes.push({ op: 'update', uid, ...params });
      return { documentId: params.documentId };
    }),
    publish: vi.fn(async (params: any) => {
      writes.push({ op: 'publish', uid, ...params });
    }),
  });
  const dbFindMany = vi.fn(async ({ where }: any) => {
    const key = Object.keys(where).find((k) => k !== 'locale')!;
    return existing.filter(
      (row) => where[key].$in.includes(String(row[key])) && (!where.locale || row.locale === where.locale)
    );
  });
  const strapi = {
    contentTypes,
    documents: vi.fn(document),
    db: {
      query: vi.fn((uid: string) =>
        uid === 'plugin::upload.file' ? { findMany: async () => files } : { findMany: dbFindMany }
      ),
    },
  };
  return { strapi, writes, dbFindMany };
};

const fields = (uid = ARTICLE) => describe({ contentTypes }, uid)!;

const request = (overrides: Partial<ImportRequest> = {}): ImportRequest => ({
  status: 'draft',
  matchField: 'slug',
  mapping: { Title: 'title', Slug: 'slug' },
  relations: {},
  onMissingRelation: 'skip',
  dryRun: false,
  rowOffset: 0,
  rows: [],
  ...overrides,
});

group('importBatch', () => {
  it('creates rows with no match and updates rows with one match', async () => {
    const { strapi, writes } = makeStrapi({ existing: [{ documentId: 'd1', slug: 'old' }] });

    const result = await importBatch(
      strapi,
      ARTICLE,
      fields(),
      request({ rows: [{ Title: 'Old', Slug: 'old' }, { Title: 'New', Slug: 'new' }] })
    );

    expect(result).toEqual({
      aborted: false,
      results: [
        { row: 1, action: 'updated', documentId: 'd1' },
        { row: 2, action: 'created', documentId: 'new-1' },
      ],
    });
    expect(writes).toEqual([
      { op: 'update', uid: ARTICLE, documentId: 'd1', data: { title: 'Old', slug: 'old' } },
      { op: 'create', uid: ARTICLE, documentId: 'new-1', data: { title: 'New', slug: 'new' } },
    ]);
  });

  it('numbers rows from rowOffset', async () => {
    const { strapi } = makeStrapi();
    const result = await importBatch(strapi, ARTICLE, fields(), request({ rowOffset: 200, rows: [{ Title: 'a', Slug: 'a' }] }));
    expect(result.results[0].row).toBe(201);
  });

  it('updates the entry an earlier row in the same batch created instead of creating twice', async () => {
    const { strapi, writes } = makeStrapi();

    const result = await importBatch(
      strapi,
      ARTICLE,
      fields(),
      request({ rows: [{ Title: 'First', Slug: 'news' }, { Title: 'Second', Slug: 'news' }] })
    );

    expect(result.results.map((r) => r.action)).toEqual(['created', 'updated']);
    expect(writes.map((w) => [w.op, w.documentId])).toEqual([
      ['create', 'new-1'],
      ['update', 'new-1'],
    ]);
  });

  it('trims match keys and compares them as strings', async () => {
    const { strapi, dbFindMany } = makeStrapi({ existing: [{ documentId: 'c9', code: 5 }] });

    const result = await importBatch(
      strapi,
      CATEGORY,
      fields(CATEGORY),
      request({ matchField: 'code', mapping: { Code: 'code', Name: 'name' }, rows: [{ Code: ' 5 ', Name: 'Five' }] })
    );

    expect(dbFindMany).toHaveBeenCalledWith({ where: { code: { $in: ['5'] } }, select: ['documentId', 'code'] });
    expect(result.results).toEqual([{ row: 1, action: 'updated', documentId: 'c9' }]);
  });

  it('treats a blank match cell as a create', async () => {
    const { strapi } = makeStrapi();
    const result = await importBatch(strapi, ARTICLE, fields(), request({ rows: [{ Title: 'a', Slug: '' }] }));
    expect(result.results[0].action).toBe('created');
  });

  it('refuses to update when the match key hits more than one document', async () => {
    const { strapi, writes } = makeStrapi({
      existing: [
        { documentId: 'd1', slug: 'dup' },
        { documentId: 'd1', slug: 'dup' },
        { documentId: 'd2', slug: 'dup' },
      ],
    });

    const result = await importBatch(strapi, ARTICLE, fields(), request({ rows: [{ Title: 'x', Slug: 'dup' }] }));

    expect(result.results).toEqual([{ row: 1, action: 'error', error: 'ambiguous match: slug "dup" matches 2 entries' }]);
    expect(writes).toEqual([]);
  });

  it('filters existing entries by locale for localized types, except when matching on documentId', async () => {
    const { strapi, dbFindMany, writes } = makeStrapi({
      existing: [
        { documentId: 'd1', slug: 'a', locale: 'en' },
        { documentId: 'd1', slug: 'a', locale: 'fr' },
      ],
    });

    await importBatch(strapi, ARTICLE, fields(), request({ locale: 'fr', rows: [{ Title: 'A', Slug: 'a' }] }));
    expect(dbFindMany).toHaveBeenLastCalledWith({
      where: { slug: { $in: ['a'] }, locale: 'fr' },
      select: ['documentId', 'slug'],
    });
    expect(writes[0]).toMatchObject({ op: 'update', documentId: 'd1', locale: 'fr' });

    await importBatch(
      strapi,
      ARTICLE,
      fields(),
      request({
        locale: 'de',
        matchField: 'documentId',
        mapping: { Id: 'documentId', Title: 'title' },
        rows: [{ Id: 'd1', Title: 'B' }],
      })
    );
    expect(dbFindMany).toHaveBeenLastCalledWith({ where: { documentId: { $in: ['d1'] } }, select: ['documentId'] });
    expect(writes[1]).toEqual({ op: 'update', uid: ARTICLE, documentId: 'd1', locale: 'de', data: { title: 'B' } });
  });

  it('publishes after writing when status is published and the type has Draft and Publish', async () => {
    const { strapi, writes } = makeStrapi();
    await importBatch(
      strapi,
      ARTICLE,
      fields(),
      request({ status: 'published', locale: 'en', rows: [{ Title: 'a', Slug: 'a' }] })
    );
    expect(writes.map((w) => w.op)).toEqual(['create', 'publish']);
    expect(writes[1]).toEqual({ op: 'publish', uid: ARTICLE, documentId: 'new-1', locale: 'en' });
  });

  it('passes no locale and never publishes for a type without i18n or Draft and Publish', async () => {
    const { strapi, writes } = makeStrapi();
    await importBatch(
      strapi,
      CATEGORY,
      fields(CATEGORY),
      request({ status: 'published', locale: 'en', mapping: { Slug: 'slug' }, rows: [{ Slug: 'news' }] })
    );
    expect(writes).toEqual([{ op: 'create', uid: CATEGORY, documentId: 'new-1', data: { slug: 'news' } }]);
  });

  it('links relations by the chosen target field and sets to-many relations from | lists', async () => {
    const { strapi, writes } = makeStrapi({
      categories: [
        { documentId: 'c1', slug: 'news' },
        { documentId: 'c2', slug: 'sport' },
      ],
    });

    await importBatch(
      strapi,
      ARTICLE,
      fields(),
      request({
        mapping: { Slug: 'slug', Category: 'category' },
        relations: { category: { matchOn: 'slug' } },
        rows: [
          { Slug: 'a', Category: 'sport' },
          { Slug: 'b', Category: '' },
        ],
      })
    );

    expect(writes[0].data).toEqual({ slug: 'a', category: { set: ['c2'] } });
    expect(writes[1].data).toEqual({ slug: 'b', category: { set: [] } });
  });

  it('skips rows whose relation target is missing when onMissingRelation is skip', async () => {
    const { strapi, writes } = makeStrapi({ categories: [{ documentId: 'c1', slug: 'news' }] });

    const result = await importBatch(
      strapi,
      ARTICLE,
      fields(),
      request({
        mapping: { Slug: 'slug', Category: 'category' },
        relations: { category: { matchOn: 'slug' } },
        rows: [
          { Slug: 'a', Category: 'gone' },
          { Slug: 'b', Category: 'news' },
        ],
      })
    );

    expect(result.results).toEqual([
      { row: 1, action: 'skipped', error: 'category: no entry with slug "gone"' },
      { row: 2, action: 'created', documentId: 'new-1' },
    ]);
    expect(writes).toHaveLength(1);
  });

  it('writes nothing and aborts the batch when a target is missing in the last row and onMissingRelation is fail', async () => {
    const { strapi, writes } = makeStrapi({ categories: [{ documentId: 'c1', slug: 'news' }] });

    const result = await importBatch(
      strapi,
      ARTICLE,
      fields(),
      request({
        onMissingRelation: 'fail',
        mapping: { Slug: 'slug', Category: 'category' },
        relations: { category: { matchOn: 'slug' } },
        rows: [
          { Slug: 'a', Category: 'news' },
          { Slug: 'b', Category: 'gone' },
        ],
      })
    );

    expect(result.aborted).toBe(true);
    expect(result.results).toEqual([
      { row: 1, action: 'error', error: 'not written: a relation target is missing in this batch' },
      { row: 2, action: 'error', error: 'category: no entry with slug "gone"' },
    ]);
    expect(writes).toEqual([]);
  });

  it('links media by url or name', async () => {
    const { strapi, writes } = makeStrapi({ files: [{ id: 7, url: '/uploads/a.png', name: 'a.png' }] });
    await importBatch(
      strapi,
      ARTICLE,
      fields(),
      request({ mapping: { Slug: 'slug', Cover: 'cover' }, rows: [{ Slug: 'a', Cover: 'a.png' }] })
    );
    expect(writes[0].data).toEqual({ slug: 'a', cover: 7 });
  });

  it('reports coerce errors per cell and keeps going', async () => {
    const { strapi } = makeStrapi();
    const result = await importBatch(
      strapi,
      ARTICLE,
      fields(),
      request({
        mapping: { Slug: 'slug', Views: 'views' },
        rows: [
          { Slug: 'a', Views: 'many' },
          { Slug: 'b', Views: '3' },
        ],
      })
    );
    expect(result.results).toEqual([
      { row: 1, action: 'error', error: 'views: "many" is not an integer' },
      { row: 2, action: 'created', documentId: 'new-1' },
    ]);
  });

  it('flattens Strapi ValidationError details into the row error', async () => {
    const failure = Object.assign(new Error('2 errors occurred'), {
      details: { errors: [{ path: ['title'], message: 'title must be defined.' }] },
    });
    const { strapi } = makeStrapi({ failCreate: failure });
    const result = await importBatch(strapi, ARTICLE, fields(), request({ rows: [{ Title: '', Slug: 'a' }] }));
    expect(result.results).toEqual([{ row: 1, action: 'error', error: 'title: title must be defined.' }]);
  });

  it("reads cells the export escaped with a leading ' as their original value", async () => {
    const { strapi, writes } = makeStrapi({ existing: [{ documentId: 'd1', slug: '-draft' }] });
    const result = await importBatch(
      strapi,
      ARTICLE,
      fields(),
      request({ rows: [{ Title: "'=SUM(A1)", Slug: "'-draft" }] })
    );
    expect(result.results).toEqual([{ row: 1, action: 'updated', documentId: 'd1' }]);
    expect(writes[0].data).toEqual({ title: '=SUM(A1)', slug: '-draft' });
  });

  it('decides actions but writes nothing on a dry run', async () => {
    const { strapi, writes } = makeStrapi({ existing: [{ documentId: 'd1', slug: 'a' }] });
    const result = await importBatch(
      strapi,
      ARTICLE,
      fields(),
      request({
        dryRun: true,
        rows: [
          { Title: 'a', Slug: 'a' },
          { Title: 'b', Slug: 'b' },
          { Title: 'b2', Slug: 'b' },
        ],
      })
    );
    expect(result.results.map((r) => r.action)).toEqual(['updated', 'created', 'updated']);
    expect(writes).toEqual([]);
  });
});
