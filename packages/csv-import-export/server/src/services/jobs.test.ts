import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createJobs, JOB_UID } from './jobs';

const makeStrapi = (stored: any = null) => {
  const query = {
    create: vi.fn(async ({ data }: any) => ({ id: 1, ...data })),
    update: vi.fn(async ({ where, data }: any) => ({ id: where.id, ...stored, ...data })),
    findOne: vi.fn(async () => stored),
    findMany: vi.fn(async (_params: any) => [{ id: 1 }]),
    count: vi.fn(async () => 41),
  };
  return { strapi: { db: { query: vi.fn(() => query) } }, query };
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-09T12:00:00.000Z'));
});
afterEach(() => vi.useRealTimers());

describe('jobs', () => {
  it('creates a running job with zeroed counters and a snapshot of the user name', async () => {
    const { strapi, query } = makeStrapi();

    await createJobs(strapi).create({
      kind: 'import',
      targetUid: 'api::article.article',
      targetLocale: 'en',
      targetStatus: 'draft',
      fileName: 'a.csv',
      config: { matchField: 'slug' },
      totalRows: 120,
      user: { id: 3, firstname: 'Ada', lastname: 'Lovelace', email: 'ada@example.com' },
    });

    expect(strapi.db.query).toHaveBeenCalledWith(JOB_UID);
    expect(query.create).toHaveBeenCalledWith({
      data: {
        kind: 'import',
        targetUid: 'api::article.article',
        targetLocale: 'en',
        targetStatus: 'draft',
        fileName: 'a.csv',
        config: { matchField: 'slug' },
        totalRows: 120,
        state: 'running',
        created: 0,
        updated: 0,
        skipped: 0,
        errored: 0,
        errors: [],
        startedById: 3,
        startedByName: 'Ada Lovelace',
        startedAt: new Date('2026-10-09T12:00:00.000Z'),
      },
    });
  });

  it('falls back to the email when the admin user has no name', async () => {
    const { strapi, query } = makeStrapi();
    await createJobs(strapi).create({
      kind: 'export',
      targetUid: 'x',
      targetStatus: 'draft',
      user: { id: 1, email: 'a@b.co' },
    });
    expect(query.create.mock.calls[0][0].data.startedByName).toBe('a@b.co');
  });

  it('adds batch counts and stores only failed and skipped rows with their CSV data', async () => {
    const stored = {
      id: 5,
      created: 1,
      updated: 0,
      skipped: 0,
      errored: 1,
      errors: [{ row: 2, data: {}, message: 'old' }],
    };
    const { strapi, query } = makeStrapi(stored);

    await createJobs(strapi).record(
      5,
      [
        { row: 101, action: 'created', documentId: 'a' },
        { row: 102, action: 'updated', documentId: 'b' },
        { row: 103, action: 'skipped', error: 'category: no entry with slug "x"' },
        { row: 104, action: 'error', error: 'views: "y" is not an integer' },
      ],
      [{ s: '1' }, { s: '2' }, { s: '3' }, { s: '4' }],
      100
    );

    expect(query.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: {
        created: 2,
        updated: 1,
        skipped: 1,
        errored: 2,
        errors: [
          { row: 2, data: {}, message: 'old' },
          { row: 103, data: { s: '3' }, message: 'category: no entry with slug "x"' },
          { row: 104, data: { s: '4' }, message: 'views: "y" is not an integer' },
        ],
      },
    });
  });

  it('finishes a job with a state, a finish time and optional totals', async () => {
    const { strapi, query } = makeStrapi({ id: 5 });
    await createJobs(strapi).finish(5, 'completed', { totalRows: 30 });
    expect(query.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { state: 'completed', finishedAt: new Date('2026-10-09T12:00:00.000Z'), totalRows: 30 },
    });
  });

  it('pages jobs newest first, limited to readable uids, without errors or config', async () => {
    const { strapi, query } = makeStrapi();

    const page = await createJobs(strapi).findPage({ page: 2, pageSize: 20, uids: ['api::a.a'], kind: 'import' });

    const where = { targetUid: { $in: ['api::a.a'] }, kind: 'import' };
    expect(query.findMany).toHaveBeenCalledWith({
      where,
      orderBy: { startedAt: 'desc' },
      offset: 20,
      limit: 20,
      select: expect.any(Array),
    });
    const { select } = query.findMany.mock.calls[0][0];
    expect(select).not.toContain('errors');
    expect(select).not.toContain('config');
    expect(query.count).toHaveBeenCalledWith({ where });
    expect(page.pagination).toEqual({ page: 2, pageSize: 20, total: 41, pageCount: 3 });
  });
});
