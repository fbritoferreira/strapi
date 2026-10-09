import { describe as group, expect, it, vi } from 'vitest';

import { contentTypes } from '../test/strapi-mock';
import createController from './csv';

const ARTICLE = 'api::article.article';
const CM = 'plugin::content-manager.explorer.';

/** koa context stand-in; `throw` always throws, like koa's. */
const makeCtx = ({ params = {}, body = {}, query = {}, denied = [] as string[] } = {}): any => {
  const headers: Record<string, string> = {};
  return {
    params,
    query,
    request: { body },
    state: {
      user: { id: 3, firstname: 'Ada', lastname: 'L' },
      userAbility: { can: (action: string, uid: string) => !denied.includes(`${action}@${uid}`) },
    },
    set: (key: string, value: string) => {
      headers[key] = value;
    },
    headers,
    throw: (status: number, message: string) => {
      throw Object.assign(new Error(message), { status });
    },
  };
};

const makeStrapi = (job: any = null) => {
  const jobQuery = {
    create: vi.fn(async ({ data }: any) => ({ id: 9, ...data })),
    update: vi.fn(async ({ where, data }: any) => ({ id: where.id, ...data })),
    findOne: vi.fn(async (_params: any) => job),
    findMany: vi.fn(async (_params: any) => []),
    count: vi.fn(async (_params: any) => 0),
  };
  const documents = {
    findMany: vi.fn(async (_params: any) => []),
    create: vi.fn(async (_params: any) => ({ documentId: 'new-1' })),
    update: vi.fn(),
    publish: vi.fn(),
  };
  const strapi = {
    contentTypes,
    documents: vi.fn(() => documents),
    db: {
      query: vi.fn((uid: string) =>
        uid === 'plugin::csv-import-export.job' ? jobQuery : { findMany: async () => [] }
      ),
    },
    plugin: vi.fn(() => ({
      config: (key: string) => ({ escapeFormulas: true, maxFileSizeMb: 10 })[key],
    })),
  };
  return { strapi, jobQuery, documents };
};

const importBody = (overrides: Record<string, unknown> = {}) => ({
  status: 'draft',
  matchField: 'slug',
  mapping: { Slug: 'slug' },
  relations: {},
  onMissingRelation: 'skip',
  dryRun: false,
  rowOffset: 0,
  rows: [{ Slug: 'a' }],
  ...overrides,
});

group('csv controller', () => {
  it('lists readable collection types with the upload limit', async () => {
    const { strapi } = makeStrapi();
    const ctx = makeCtx({ denied: [`${CM}read@api::tag.tag`] });
    await createController({ strapi }).contentTypes(ctx);
    expect(ctx.body.data.map((c: any) => c.uid)).toEqual([ARTICLE, 'api::category.category']);
    expect(ctx.body.meta).toEqual({ maxFileSizeMb: 10 });
  });

  it('returns 404 for a uid that is not importable and 403 without read permission', async () => {
    const { strapi } = makeStrapi();
    const controller = createController({ strapi });
    await expect(controller.schema(makeCtx({ params: { uid: 'api::homepage.homepage' } }))).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      controller.schema(makeCtx({ params: { uid: ARTICLE }, denied: [`${CM}read@${ARTICLE}`] }))
    ).rejects.toMatchObject({ status: 403 });
  });

  it('returns 400 with the validation message for a bad import body', async () => {
    const { strapi } = makeStrapi();
    const ctx = makeCtx({ params: { uid: ARTICLE }, body: importBody({ status: 'live' }) });
    await expect(createController({ strapi }).import(ctx)).rejects.toMatchObject({
      status: 400,
      message: 'status must be "draft" or "published"',
    });
  });

  it('requires publish permission to import as published', async () => {
    const { strapi, documents } = makeStrapi();
    const ctx = makeCtx({
      params: { uid: ARTICLE },
      body: importBody({ status: 'published' }),
      denied: [`${CM}publish@${ARTICLE}`],
    });
    await expect(createController({ strapi }).import(ctx)).rejects.toMatchObject({ status: 403 });
    expect(documents.create).not.toHaveBeenCalled();
  });

  it('imports a batch and records it on a running job for the same collection', async () => {
    const { strapi, jobQuery } = makeStrapi({
      id: 9,
      targetUid: ARTICLE,
      state: 'running',
      created: 0,
      updated: 0,
      skipped: 0,
      errored: 0,
      errors: [],
    });
    const ctx = makeCtx({ params: { uid: ARTICLE }, body: importBody({ jobId: 9 }) });

    await createController({ strapi }).import(ctx);

    expect(ctx.body.data).toEqual({ aborted: false, results: [{ row: 1, action: 'created', documentId: 'new-1' }] });
    expect(jobQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 9 }, data: expect.objectContaining({ created: 1 }) })
    );
  });

  it('rejects a jobId that belongs to another collection or is finished', async () => {
    const { strapi, documents } = makeStrapi({ id: 9, targetUid: 'api::category.category', state: 'running' });
    const ctx = makeCtx({ params: { uid: ARTICLE }, body: importBody({ jobId: 9 }) });
    await expect(createController({ strapi }).import(ctx)).rejects.toMatchObject({ status: 400 });
    expect(documents.create).not.toHaveBeenCalled();
  });

  it('does not touch the job on a dry run', async () => {
    const { strapi, jobQuery } = makeStrapi();
    const ctx = makeCtx({ params: { uid: ARTICLE }, body: importBody({ jobId: 9, dryRun: true }) });
    await createController({ strapi }).import(ctx);
    expect(jobQuery.findOne).not.toHaveBeenCalled();
    expect(jobQuery.update).not.toHaveBeenCalled();
  });

  it('creates an import job for the current user', async () => {
    const { strapi, jobQuery } = makeStrapi();
    const ctx = makeCtx({ body: { uid: ARTICLE, status: 'draft', fileName: 'a.csv', totalRows: 10, config: {} } });
    await createController({ strapi }).createJob(ctx);
    expect(ctx.status).toBe(201);
    expect(jobQuery.create.mock.calls[0][0].data).toMatchObject({
      kind: 'import',
      targetUid: ARTICLE,
      startedById: 3,
      totalRows: 10,
    });
  });

  it('only lets the user who started a job finish it', async () => {
    const { strapi } = makeStrapi({ id: 9, state: 'running', startedById: 4 });
    const ctx = makeCtx({ params: { id: '9' }, body: { state: 'completed' } });
    await expect(createController({ strapi }).finishJob(ctx)).rejects.toMatchObject({ status: 403 });
  });

  it('exports CSV as an attachment and logs a completed export job', async () => {
    const { strapi, jobQuery } = makeStrapi();
    const ctx = makeCtx({
      params: { uid: ARTICLE },
      body: { status: 'draft', columns: [{ field: 'documentId', header: 'id' }], fileName: 'articles.csv' },
    });

    await createController({ strapi }).export(ctx);

    expect(ctx.body).toBe('id\r\n');
    expect(ctx.headers['Content-Type']).toBe('text/csv; charset=utf-8');
    expect(ctx.headers['Content-Disposition']).toBe('attachment; filename="articles.csv"');
    expect(jobQuery.create.mock.calls[0][0].data).toMatchObject({ kind: 'export', targetUid: ARTICLE });
    expect(jobQuery.update).toHaveBeenCalledWith({
      where: { id: 9 },
      data: expect.objectContaining({ state: 'completed', totalRows: 0 }),
    });
  });

  it('strips characters that would break the Content-Disposition header from the file name', async () => {
    const { strapi } = makeStrapi();
    const ctx = makeCtx({
      params: { uid: ARTICLE },
      body: { status: 'draft', columns: [{ field: 'documentId', header: 'id' }], fileName: 'a"\r\nb.csv' },
    });
    await createController({ strapi }).export(ctx);
    expect(ctx.headers['Content-Disposition']).toBe('attachment; filename="ab.csv"');
  });

  it('hides jobs for collections the user cannot read', async () => {
    const { strapi } = makeStrapi({ id: 9, targetUid: ARTICLE });
    const ctx = makeCtx({ params: { id: '9' }, denied: [`${CM}read@${ARTICLE}`] });
    await expect(createController({ strapi }).job(ctx)).rejects.toMatchObject({ status: 404 });
  });

  it('clamps history page size to 100', async () => {
    const { strapi, jobQuery } = makeStrapi();
    const ctx = makeCtx({ query: { page: '1', pageSize: '1000' } });
    await createController({ strapi }).jobs(ctx);
    expect(jobQuery.findMany.mock.calls[0][0].limit).toBe(100);
  });
});
