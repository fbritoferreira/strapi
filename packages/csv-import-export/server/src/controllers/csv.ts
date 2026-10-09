import type { FieldDescription, PublicationStatus } from '../types';
import { exportCsv } from '../services/exporter';
import { importBatch } from '../services/importer';
import { createJobs } from '../services/jobs';
import { createGuard } from '../services/permissions';
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

/** Strips quotes, backslashes and line breaks from a download file name. */
const safeFileName = (name: unknown, fallback: string) =>
  (typeof name === 'string' ? name.replace(/["\\\r\n]/g, '') : '') || fallback;

/** Koa handlers behind the plugin's admin routes; each one sets `ctx.body`. */
export interface CsvController {
  /** `GET /content-types`: collections the user can read, plus `meta.maxFileSizeMb`. */
  contentTypes(ctx: any): Promise<void>;
  /** `GET /content-types/:uid/schema`: the fields an import can map to. */
  schema(ctx: any): Promise<void>;
  /** `POST /jobs`: starts an import job for the calling admin. */
  createJob(ctx: any): Promise<void>;
  /** `POST /import/:uid`: imports or dry-runs one batch of rows. */
  import(ctx: any): Promise<void>;
  /** `POST /jobs/:id/finish`: marks the caller's import job completed or failed. */
  finishJob(ctx: any): Promise<void>;
  /** `POST /export/:uid`: exports the chosen columns as `{ fileName, rowCount, csv }`. */
  export(ctx: any): Promise<void>;
  /** `GET /jobs`: pages through jobs for collections the user can read. */
  jobs(ctx: any): Promise<void>;
  /** `GET /jobs/:id`: one job with its failed rows. */
  job(ctx: any): Promise<void>;
}

export default ({ strapi }: { strapi: any }): CsvController => {
  const jobs = createJobs(strapi);
  const config = (key: string) => strapi.plugin(PLUGIN).config(key);

  /** Any rule for the collection: enough to list it, not to touch its entries. */
  const can = (ctx: any, action: string, uid: string) =>
    ctx.state.userAbility?.can(`${CONTENT_MANAGER}${action}`, uid) === true;

  const isLocalized = (uid: string) => strapi.contentTypes[uid]?.pluginOptions?.i18n?.localized === true;

  /** The locale a request acts on: the one asked for, or the default locale for localized types. */
  const resolveLocale = async (uid: string, locale?: string) => {
    if (!isLocalized(uid)) return undefined;
    return locale ?? (await strapi.plugin('i18n')?.service('locales')?.getDefaultLocale());
  };

  /** Field- and locale-aware check (see services/permissions.ts). */
  const requireCan = (
    ctx: any,
    uid: string,
    actions: string[],
    scope: { locale?: string; fields?: string[] } = {}
  ) => {
    const guard = createGuard(strapi, ctx.state.userAbility);
    for (const action of actions) {
      if (!guard.can(action, uid, scope)) {
        const fields = scope.fields?.filter((f) => f !== 'documentId') ?? [];
        ctx.throw(
          403,
          `missing content-manager ${action} permission on ${uid}` +
            (fields.length ? ` for ${fields.join(', ')}` : '') +
            (scope.locale ? ` in locale ${scope.locale}` : '')
        );
      }
    }
  };

  /** Reading a relation's target field needs read permission on the related collection too. */
  const requireRelationReads = async (ctx: any, fields: FieldDescription[], pairs: Array<[string, string]>) => {
    for (const [name, matchOn] of pairs) {
      const target = fields.find((f) => f.name === name)?.relation?.target;
      if (!target) continue;
      requireCan(ctx, target, ['read'], { locale: await resolveLocale(target), fields: [matchOn] });
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
      // Field names only; the actions that touch entries check fields and locale themselves.
      if (!can(ctx, 'read', uid)) ctx.throw(403, `missing content-manager read permission on ${uid}`);
      ctx.body = { data: fields };
    },

    async createJob(ctx: any) {
      const { uid, locale, status, fileName, config: jobConfig, totalRows } = ctx.request.body ?? {};
      fieldsOr404(ctx, uid);
      if (!isStatus(status)) ctx.throw(400, 'status must be "draft" or "published"');
      if (!Number.isInteger(totalRows) || totalRows < 0) ctx.throw(400, 'totalRows must be a non-negative integer');
      const targetLocale = await resolveLocale(uid, locale);
      requireCan(ctx, uid, importActions(status), { locale: targetLocale });

      const job = await jobs.create({
        kind: 'import',
        targetUid: uid,
        targetLocale,
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
      const locale = await resolveLocale(uid, body.locale);
      const mapped = Object.values(body.mapping as Record<string, string>);
      requireCan(ctx, uid, importActions(body.status), { locale, fields: mapped });
      await requireRelationReads(
        ctx,
        fields,
        mapped.filter((name) => body.relations?.[name]).map((name) => [name, body.relations[name].matchOn])
      );

      const logged = !body.dryRun;
      if (logged) {
        const job = await jobs.findOne(body.jobId);
        if (
          !job ||
          job.kind !== 'import' ||
          job.targetUid !== uid ||
          job.state !== 'running' ||
          job.startedById !== ctx.state.user.id
        ) {
          ctx.throw(400, 'jobId does not reference your running import job for this collection');
        }
      }

      const result = await importBatch(strapi, uid, fields, { ...body, locale });
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
      const locale = await resolveLocale(uid, body.locale);
      requireCan(ctx, uid, ['read'], { locale, fields: body.columns.map((c: any) => c.field) });
      await requireRelationReads(
        ctx,
        fields,
        body.columns.map((c: any) => [c.field, c.matchOn ?? 'documentId'])
      );

      const fileName = safeFileName(
        body.fileName,
        `${strapi.contentTypes[uid].info.singularName}-${new Date().toISOString().slice(0, 10)}.csv`
      );
      const job = await jobs.create({
        kind: 'export',
        targetUid: uid,
        targetLocale: locale,
        targetStatus: body.status,
        fileName,
        config: { columns: body.columns },
        user: ctx.state.user,
      });

      try {
        const { csv, rowCount } = await exportCsv(strapi, uid, fields, { ...body, locale }, {
          escapeFormulas: config('escapeFormulas') !== false,
        });
        await jobs.finish(job.id, 'completed', { totalRows: rowCount });
        // JSON, not a text/csv attachment: the admin's useFetchClient().post
        // always parses the response as JSON. The browser builds the file.
        ctx.body = { data: { fileName, rowCount, csv } };
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
