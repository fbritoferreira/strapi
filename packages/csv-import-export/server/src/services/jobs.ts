import type { PublicationStatus, RowResult } from '../types';

export const JOB_UID = 'plugin::csv-import-export.job';

const LIST_FIELDS = [
  'id',
  'kind',
  'targetUid',
  'targetLocale',
  'targetStatus',
  'fileName',
  'state',
  'totalRows',
  'created',
  'updated',
  'skipped',
  'errored',
  'startedById',
  'startedByName',
  'startedAt',
  'finishedAt',
  'updatedAt',
];

interface CreateJobInput {
  kind: 'import' | 'export';
  targetUid: string;
  targetLocale?: string;
  targetStatus: PublicationStatus;
  fileName?: string;
  config?: unknown;
  totalRows?: number;
  user: { id: number; firstname?: string; lastname?: string; email?: string };
}

const displayName = (user: CreateJobInput['user']) =>
  [user.firstname, user.lastname].filter(Boolean).join(' ') || user.email || `user ${user.id}`;

export const createJobs = (strapi: any) => {
  const query = () => strapi.db.query(JOB_UID);

  return {
    create: ({ user, totalRows = 0, ...input }: CreateJobInput) =>
      query().create({
        data: {
          ...input,
          totalRows,
          state: 'running',
          created: 0,
          updated: 0,
          skipped: 0,
          errored: 0,
          errors: [],
          startedById: user.id,
          startedByName: displayName(user),
          startedAt: new Date(),
        },
      }),

    /**
     * ponytail: read-then-write without a lock. Safe because the admin client
     * sends one batch at a time per job; needs an atomic increment if batches
     * are ever sent in parallel.
     */
    async record(id: number, results: RowResult[], rows: Record<string, string>[], rowOffset: number) {
      const job = await query().findOne({ where: { id } });
      const count = (action: RowResult['action']) => results.filter((r) => r.action === action).length;
      const failures = results
        .filter((r) => r.action === 'error' || r.action === 'skipped')
        .map((r) => ({ row: r.row, data: rows[r.row - rowOffset - 1], message: r.error ?? '' }));

      return query().update({
        where: { id },
        data: {
          created: job.created + count('created'),
          updated: job.updated + count('updated'),
          skipped: job.skipped + count('skipped'),
          errored: job.errored + count('error'),
          errors: [...(job.errors ?? []), ...failures],
        },
      });
    },

    finish: (id: number, state: 'completed' | 'failed', totals: { totalRows?: number } = {}) =>
      query().update({ where: { id }, data: { state, finishedAt: new Date(), ...totals } }),

    findOne: (id: number) => query().findOne({ where: { id } }),

    async findPage({
      page,
      pageSize,
      uids,
      kind,
    }: {
      page: number;
      pageSize: number;
      uids: string[];
      kind?: 'import' | 'export';
    }) {
      const where = { targetUid: { $in: uids }, ...(kind ? { kind } : {}) };
      const [results, total] = await Promise.all([
        query().findMany({
          where,
          orderBy: { startedAt: 'desc' },
          offset: (page - 1) * pageSize,
          limit: pageSize,
          select: LIST_FIELDS,
        }),
        query().count({ where }),
      ]);
      return { results, pagination: { page, pageSize, total, pageCount: Math.ceil(total / pageSize) } };
    },
  };
};
