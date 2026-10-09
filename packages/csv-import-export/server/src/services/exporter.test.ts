import { describe as group, expect, it, vi } from 'vitest';

import { contentTypes } from '../test/strapi-mock';
import { exportCsv, PAGE_SIZE } from './exporter';
import { describe } from './schema';

const ARTICLE = 'api::article.article';
const fields = describe({ contentTypes }, ARTICLE)!;

const makeStrapi = (pages: any[][]) => {
  const findMany = vi.fn(async (_params: any) => pages.shift() ?? []);
  return { strapi: { contentTypes, documents: vi.fn(() => ({ findMany })) }, findMany };
};

group('exportCsv', () => {
  it('writes headers, scalar values, relation match values and media urls', async () => {
    const { strapi, findMany } = makeStrapi([
      [
        {
          documentId: 'd1',
          title: 'Hello, "world"',
          views: 3,
          category: { slug: 'news' },
          tags: [{ documentId: 't1' }, { documentId: 't2' }],
          cover: { url: '/uploads/a.png' },
        },
        { documentId: 'd2', title: 'Empty', views: null, category: null, tags: [], cover: null },
      ],
    ]);

    const { csv, rowCount } = await exportCsv(
      strapi,
      ARTICLE,
      fields,
      {
        locale: 'en',
        status: 'published',
        columns: [
          { field: 'documentId', header: 'id' },
          { field: 'title', header: 'Title' },
          { field: 'views', header: 'Views' },
          { field: 'category', header: 'Category', matchOn: 'slug' },
          { field: 'tags', header: 'Tags' },
          { field: 'cover', header: 'Cover' },
        ],
      },
      { escapeFormulas: true }
    );

    expect(findMany).toHaveBeenCalledWith({
      locale: 'en',
      status: 'published',
      populate: { category: { fields: ['slug'] }, tags: { fields: ['documentId'] }, cover: { fields: ['url'] } },
      sort: 'id:asc',
      limit: PAGE_SIZE,
      start: 0,
    });
    expect(rowCount).toBe(2);
    expect(csv).toBe(
      [
        'id,Title,Views,Category,Tags,Cover',
        'd1,"Hello, ""world""",3,news,t1|t2,/uploads/a.png',
        'd2,Empty,,,,',
      ].join('\r\n')
    );
  });

  it('pages until a short page comes back', async () => {
    const full = Array.from({ length: PAGE_SIZE }, (_, i) => ({ documentId: `d${i}` }));
    const { strapi, findMany } = makeStrapi([full, [{ documentId: 'last' }]]);

    const { rowCount } = await exportCsv(
      strapi,
      ARTICLE,
      fields,
      { status: 'draft', columns: [{ field: 'documentId', header: 'id' }] },
      { escapeFormulas: true }
    );

    expect(rowCount).toBe(PAGE_SIZE + 1);
    expect(findMany).toHaveBeenCalledTimes(2);
    expect(findMany.mock.calls[1][0].start).toBe(PAGE_SIZE);
  });

  it('escapes formula-looking strings, including ones containing a newline, but not numbers', async () => {
    const { strapi } = makeStrapi([
      [
        { title: '=1+1\nx', views: -5 },
        { title: '@SUM(A1)', views: 1 },
      ],
    ]);

    const { csv } = await exportCsv(
      strapi,
      ARTICLE,
      fields,
      {
        status: 'draft',
        columns: [
          { field: 'title', header: 't' },
          { field: 'views', header: 'v' },
        ],
      },
      { escapeFormulas: true }
    );

    expect(csv).toBe(['t,v', `"'=1+1\nx",-5`, `"'@SUM(A1)",1`].join('\r\n'));
  });

  it('leaves formulas alone when escaping is disabled', async () => {
    const { strapi } = makeStrapi([[{ title: '=1+1' }]]);
    const { csv } = await exportCsv(
      strapi,
      ARTICLE,
      fields,
      { status: 'draft', columns: [{ field: 'title', header: 't' }] },
      { escapeFormulas: false }
    );
    expect(csv).toBe('t\r\n=1+1');
  });

  it('omits locale and status for types without i18n or Draft and Publish', async () => {
    const { strapi, findMany } = makeStrapi([[]]);
    await exportCsv(
      strapi,
      'api::category.category',
      describe({ contentTypes }, 'api::category.category')!,
      { locale: 'en', status: 'published', columns: [{ field: 'slug', header: 'slug' }] },
      { escapeFormulas: true }
    );
    expect(findMany).toHaveBeenCalledWith({ populate: {}, sort: 'id:asc', limit: PAGE_SIZE, start: 0 });
  });

  it('serialises json values', async () => {
    const jsonFields = [{ name: 'meta', type: 'json', required: false, unique: false }];
    const { strapi } = makeStrapi([[{ meta: { a: [1, 2] } }]]);
    const { csv } = await exportCsv(
      strapi,
      ARTICLE,
      jsonFields,
      { status: 'draft', columns: [{ field: 'meta', header: 'm' }] },
      { escapeFormulas: true }
    );
    expect(csv).toBe('m\r\n"{""a"":[1,2]}"');
  });
});
