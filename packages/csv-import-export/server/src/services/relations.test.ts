import { describe, expect, it, vi } from 'vitest';

import type { FieldDescription } from '../types';
import { loadIndex, resolveCell } from './relations';

const category: FieldDescription = {
  name: 'category',
  type: 'relation',
  required: false,
  unique: false,
  relation: { target: 'api::category.category', multiple: false },
};
const cover: FieldDescription = { name: 'cover', type: 'media', required: false, unique: false, multiple: false };

describe('loadIndex', () => {
  it('queries the relation target once with $in and indexes documentIds by match value', async () => {
    const findMany = vi.fn(async () => [
      { documentId: 'c1', slug: 'news' },
      { documentId: 'c2', slug: 'sport' },
    ]);
    const strapi = { documents: vi.fn(() => ({ findMany })) };

    const index = await loadIndex(strapi, category, 'slug', ['news', 'sport', 'gone']);

    expect(strapi.documents).toHaveBeenCalledWith('api::category.category');
    expect(findMany).toHaveBeenCalledWith({ filters: { slug: { $in: ['news', 'sport', 'gone'] } }, fields: ['slug'] });
    expect(index).toEqual(new Map([['news', ['c1']], ['sport', ['c2']]]));
  });

  it('collects every documentId sharing a value so ambiguity can be reported', async () => {
    const findMany = vi.fn(async () => [
      { documentId: 'c1', name: 'Dup' },
      { documentId: 'c2', name: 'Dup' },
      { documentId: 'c1', name: 'Dup' },
    ]);
    const index = await loadIndex({ documents: () => ({ findMany }) }, category, 'name', ['Dup']);
    expect(index.get('Dup')).toEqual(['c1', 'c2']);
  });

  it('looks media up by url or file name', async () => {
    const findMany = vi.fn(async () => [{ id: 7, url: '/uploads/a.png', name: 'a.png' }]);
    const strapi = { db: { query: vi.fn(() => ({ findMany })) } };

    const index = await loadIndex(strapi, cover, undefined, ['/uploads/a.png', 'a.png']);

    expect(strapi.db.query).toHaveBeenCalledWith('plugin::upload.file');
    expect(findMany).toHaveBeenCalledWith({
      where: { $or: [{ url: { $in: ['/uploads/a.png', 'a.png'] } }, { name: { $in: ['/uploads/a.png', 'a.png'] } }] },
      select: ['id', 'url', 'name'],
    });
    expect(index).toEqual(new Map([['/uploads/a.png', [7]], ['a.png', [7]]]));
  });
});

describe('resolveCell', () => {
  const index = new Map<string, Array<string | number>>([
    ['news', ['c1']],
    ['sport', ['c2']],
    ['dup', ['c3', 'c4']],
  ]);

  it('returns ids in cell order', () => {
    expect(resolveCell(index, 'sport | news')).toEqual({ ids: ['c2', 'c1'], missing: [], ambiguous: [] });
  });

  it('reports missing and ambiguous values', () => {
    expect(resolveCell(index, 'news|gone|dup')).toEqual({ ids: ['c1'], missing: ['gone'], ambiguous: ['dup'] });
  });

  it('resolves an empty cell to no ids', () => {
    expect(resolveCell(index, '')).toEqual({ ids: [], missing: [], ambiguous: [] });
  });
});
