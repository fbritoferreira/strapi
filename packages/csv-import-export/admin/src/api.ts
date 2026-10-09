import { useFetchClient } from '@strapi/strapi/admin';
import { useMemo } from 'react';

import type {
  ExportRequest,
  FieldDescription,
  ImportRequest,
  ImportResult,
  PublicationStatus,
} from '../../server/src/types';
import { PLUGIN_ID } from './pluginId';

export type { FieldDescription, ImportRequest, ImportResult, PublicationStatus };

export interface CollectionType {
  uid: string;
  displayName: string;
  draftAndPublish: boolean;
  localized: boolean;
}

export interface Locale {
  code: string;
  name: string;
  isDefault: boolean;
}

export interface ImportConfig {
  headers: string[];
  matchField: string;
  mapping: Record<string, string>;
  relations: ImportRequest['relations'];
  onMissingRelation: ImportRequest['onMissingRelation'];
}

export interface Job {
  id: number;
  kind: 'import' | 'export';
  targetUid: string;
  targetLocale: string | null;
  targetStatus: PublicationStatus;
  fileName: string | null;
  config: Partial<ImportConfig> | null;
  state: 'running' | 'completed' | 'failed';
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  errored: number;
  errors?: Array<{ row: number; data?: Record<string, string>; message: string }>;
  startedByName: string;
  startedAt: string;
  finishedAt: string | null;
  updatedAt: string;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
}

/** Message from a Strapi error response, falling back to the error itself. */
export const errorMessage = (error: any): string =>
  error?.response?.data?.error?.message ?? error?.message ?? String(error);

const base = `/${PLUGIN_ID}`;

export const useApi = () => {
  const { get, post } = useFetchClient();

  return useMemo(
    () => ({
      contentTypes: async () =>
        (await get<{ data: CollectionType[]; meta: { maxFileSizeMb: number } }>(`${base}/content-types`)).data,
      schema: async (uid: string) =>
        (await get<{ data: FieldDescription[] }>(`${base}/content-types/${uid}/schema`)).data.data,
      locales: async () => (await get<Locale[]>('/i18n/locales')).data,
      createJob: async (body: {
        uid: string;
        locale?: string;
        status: PublicationStatus;
        fileName: string;
        totalRows: number;
        config: ImportConfig;
      }) => (await post<{ data: Job }>(`${base}/jobs`, body)).data.data,
      importBatch: async (uid: string, body: ImportRequest) =>
        (await post<{ data: ImportResult }>(`${base}/import/${uid}`, body)).data.data,
      finishJob: async (id: number, state: 'completed' | 'failed') =>
        (await post<{ data: Job }>(`${base}/jobs/${id}/finish`, { state })).data.data,
      exportCsv: async (uid: string, body: ExportRequest & { fileName?: string }) =>
        (await post<{ data: { fileName: string; rowCount: number; csv: string } }>(`${base}/export/${uid}`, body)).data
          .data,
      jobs: async (params: { page: number; pageSize: number; uid?: string; kind?: 'import' | 'export' }) =>
        (await get<{ data: Job[]; meta: { pagination: Pagination } }>(`${base}/jobs`, { params })).data,
      job: async (id: number) => (await get<{ data: Job }>(`${base}/jobs/${id}`)).data.data,
    }),
    [get, post]
  );
};
