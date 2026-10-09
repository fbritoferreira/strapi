import type { PublicationStatus } from '../types';
import { exportCsv } from '../services/exporter';
import { importBatch } from '../services/importer';
import { createJobs } from '../services/jobs';
import { describe, listCollectionTypes } from '../services/schema';
import { isStatus, validateExportRequest, validateImportRequest } from '../services/validate';

const CONTENT_MANAGER = 'plugin::content-manager.explorer.';
const PLUGIN = 'csv-import-export';

const importActions = (status: PublicationStatus) =>
  status === 'published' ? ['create', 'update', 'publish'] : ['create', 'update'];

const positiveInt = (value: unknown, fallback: number) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

/** Keeps a download name safe inside a quoted Content-Disposition value. */
const safeFileName = (name: unknown, fallback: string) =>
  (typeof name === 'string' ? name.replace(/["\\\r\n]/g, '') : '') || fallback;

export default ({ strapi }: { strapi: any }) => {
  const jobs = createJobs(strapi);
  const config = (key: string) => strapi.plugin(PLUGIN).config(key);

  const can = (ctx: any, action: string, uid: string) =>
    ctx.state.userAbility?.can(`${CONTENT_MANAGER}${action}`, uid) === true;

  const requireCan = (ctx: any, uid: string, actions: string[]) => {
    for (const action of actions) {
      if (!can(ctx, action, uid)) ctx.throw(403, `missing content-manager ${action} permission on ${uid}`);
    }
  };

  const fieldsOr404 = (ctx: any, uid: string) => {
    const fields = describe(strapi, uid);
    if (!fields) ctx.throw(404, `"${uid}" is not an importable collection type`);
    return fields!;
  };

  const fieldsOf = (uid: string) => describe(strapi, uid);

  const readableUids = (ctx: any) => listCollectionTypes(strapi, (uid) => can(ctx, 'read', uid)).map((c) => c.uid);

  return {
    async contentTypes(ctx: any) {
      ctx.body = {
        data: listCollectionTypes(strapi, (uid) => can(ctx, 'read', uid)),
        meta: { maxFileSizeMb: config('maxFileSizeMb') },
      };
    },

    async schema(ctx: any) {
      const { uid } = ctx.params;
      const fields = fieldsOr404(ctx, uid);
      requireCan(ctx, uid, ['read']);
      ctx.body = { data: fields };
    },

    async createJob(ctx: any) {
      const { uid, locale, status, fileName, config: jobConfig, totalRows } = ctx.request.body ?? {};
      fieldsOr404(ctx, uid);
      if (!isStatus(status)) ctx.throw(400, 'status must be "draft" or "published"');
      if (!Number.isInteger(totalRows) || totalRows < 0) ctx.throw(400, 'totalRows must be a non-negative integer');
      requireCan(ctx, uid, importActions(status));

      const job = await jobs.create({
        kind: 'import',
        targetUid: uid,
        targetLocale: locale,
        targetStatus: status,
        fileName,
        config: jobConfig,
        totalRows,
        user: ctx.state.user,
      });
      ctx.status = 201;
      ctx.body = { data: job };
    },

    async import(ctx: any) {
      const { uid } = ctx.params;
      const fields = fieldsOr404(ctx, uid);
      const body = ctx.request.body;
      const error = validateImportRequest(fields, body, fieldsOf);
      if (error) ctx.throw(400, error);
      requireCan(ctx, uid, importActions(body.status));

      const logged = body.jobId !== undefined && !body.dryRun;
      if (logged) {
        const job = await jobs.findOne(body.jobId);
        if (!job || job.targetUid !== uid || job.state !== 'running') {
          ctx.throw(400, 'jobId does not reference a running import job for this collection');
        }
      }

      const result = await importBatch(strapi, uid, fields, body);
      if (logged) await jobs.record(body.jobId, result.results, body.rows, body.rowOffset);
      ctx.body = { data: result };
    },

    async finishJob(ctx: any) {
      const { state } = ctx.request.body ?? {};
      if (state !== 'completed' && state !== 'failed') ctx.throw(400, 'state must be "completed" or "failed"');
      const job = await jobs.findOne(Number(ctx.params.id));
      if (!job) ctx.throw(404, 'job not found');
      if (job.startedById !== ctx.state.user.id) ctx.throw(403, 'only the user who started a job can finish it');
      if (job.state !== 'running') ctx.throw(400, `job is already ${job.state}`);
      ctx.body = { data: await jobs.finish(job.id, state) };
    },

    async export(ctx: any) {
      const { uid } = ctx.params;
      const fields = fieldsOr404(ctx, uid);
      const body = ctx.request.body;
      const error = validateExportRequest(fields, body, fieldsOf);
      if (error) ctx.throw(400, error);
      requireCan(ctx, uid, ['read']);

      const fileName = safeFileName(
        body.fileName,
        `${strapi.contentTypes[uid].info.singularName}-${new Date().toISOString().slice(0, 10)}.csv`
      );
      const job = await jobs.create({
        kind: 'export',
        targetUid: uid,
        targetLocale: body.locale,
        targetStatus: body.status,
        fileName,
        config: { columns: body.columns },
        user: ctx.state.user,
      });

      try {
        const { csv, rowCount } = await exportCsv(strapi, uid, fields, body, {
          escapeFormulas: config('escapeFormulas') !== false,
        });
        await jobs.finish(job.id, 'completed', { totalRows: rowCount });
        ctx.set('Content-Type', 'text/csv; charset=utf-8');
        ctx.set('Content-Disposition', `attachment; filename="${fileName}"`);
        ctx.body = csv;
      } catch (exportError) {
        await jobs.finish(job.id, 'failed');
        throw exportError;
      }
    },

    async jobs(ctx: any) {
      const readable = readableUids(ctx);
      const uid = typeof ctx.query.uid === 'string' ? ctx.query.uid : undefined;
      const kind = ctx.query.kind === 'import' || ctx.query.kind === 'export' ? ctx.query.kind : undefined;
      const { results, pagination } = await jobs.findPage({
        page: positiveInt(ctx.query.page, 1),
        pageSize: Math.min(positiveInt(ctx.query.pageSize, 20), 100),
        uids: uid ? readable.filter((u) => u === uid) : readable,
        kind,
      });
      ctx.body = { data: results, meta: { pagination } };
    },

    async job(ctx: any) {
      const job = await jobs.findOne(Number(ctx.params.id));
      if (!job || !can(ctx, 'read', job.targetUid)) ctx.throw(404, 'job not found');
      ctx.body = { data: job };
    },
  };
};
