import { Badge, Box, Button, Flex, Table, Tbody, Td, Th, Thead, Tr, Typography } from '@strapi/design-system';
import { useNotification } from '@strapi/strapi/admin';
import { useCallback, useEffect, useState } from 'react';

import { type CollectionType, errorMessage, type Job, type Pagination, useApi } from '../api';
import { download, failuresToCsv } from '../utils/csv';

const PAGE_SIZE = 20;

const STATE_COLOR: Record<Job['state'], string> = {
  running: 'warning600',
  completed: 'success600',
  failed: 'danger600',
};

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : '');

interface Props {
  contentTypes: CollectionType[];
}

export const History = ({ contentTypes }: Props) => {
  const api = useApi();
  const { toggleNotification } = useNotification();
  const [page, setPage] = useState(1);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [selected, setSelected] = useState<Job | null>(null);

  const load = useCallback(async () => {
    try {
      const { data, meta } = await api.jobs({ page, pageSize: PAGE_SIZE });
      setJobs(data);
      setPagination(meta.pagination);
    } catch (error) {
      toggleNotification({ type: 'danger', message: errorMessage(error) });
    }
  }, [api, page, toggleNotification]);

  useEffect(() => {
    load();
  }, [load]);

  const open = async (id: number) => {
    try {
      setSelected(await api.job(id));
    } catch (error) {
      toggleNotification({ type: 'danger', message: errorMessage(error) });
    }
  };

  const collectionName = (uid: string) => contentTypes.find((ct) => ct.uid === uid)?.displayName ?? uid;

  const downloadErrors = (job: Job) => {
    const errors = job.errors ?? [];
    const headers = job.config?.headers ?? Object.keys(errors[0]?.data ?? {});
    download(`errors-${job.fileName ?? `job-${job.id}.csv`}`, failuresToCsv(headers, errors));
  };

  return (
    <Flex direction="column" alignItems="stretch" gap={4}>
      <Box background="neutral0" shadow="filterShadow" hasRadius>
        <Table colCount={8} rowCount={jobs.length + 1}>
          <Thead>
            <Tr>
              {['Started', 'Kind', 'Collection', 'File', 'By', 'State', 'Rows', ''].map((label) => (
                <Th key={label}>
                  <Typography variant="sigma">{label}</Typography>
                </Th>
              ))}
            </Tr>
          </Thead>
          <Tbody>
            {jobs.map((job) => (
              <Tr key={job.id}>
                <Td>
                  <Typography>{when(job.startedAt)}</Typography>
                </Td>
                <Td>
                  <Typography>{job.kind}</Typography>
                </Td>
                <Td>
                  <Typography>{collectionName(job.targetUid)}</Typography>
                </Td>
                <Td>
                  <Typography>{job.fileName}</Typography>
                </Td>
                <Td>
                  <Typography>{job.startedByName}</Typography>
                </Td>
                <Td>
                  <Badge textColor={STATE_COLOR[job.state]}>{job.state}</Badge>
                </Td>
                <Td>
                  <Typography>
                    {job.kind === 'export'
                      ? `${job.totalRows} exported`
                      : `${job.created} created, ${job.updated} updated, ${job.skipped} skipped, ${job.errored} errors`}
                  </Typography>
                </Td>
                <Td>
                  <Button variant="tertiary" size="S" onClick={() => open(job.id)}>
                    Details
                  </Button>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>

      {pagination && pagination.pageCount > 1 && (
        <Flex gap={2} justifyContent="flex-end">
          <Button variant="tertiary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <Typography>
            Page {pagination.page} of {pagination.pageCount}
          </Typography>
          <Button variant="tertiary" disabled={page >= pagination.pageCount} onClick={() => setPage(page + 1)}>
            Next
          </Button>
        </Flex>
      )}

      {selected && (
        <Box background="neutral0" padding={6} shadow="filterShadow" hasRadius>
          <Flex direction="column" alignItems="stretch" gap={3}>
            <Flex justifyContent="space-between">
              <Typography variant="delta" tag="h2">
                {`${selected.kind} of ${collectionName(selected.targetUid)}, ${when(selected.startedAt)}`}
              </Typography>
              <Flex gap={2}>
                {(selected.errors?.length ?? 0) > 0 && (
                  <Button variant="secondary" onClick={() => downloadErrors(selected)}>
                    Download {selected.errors!.length} failed rows
                  </Button>
                )}
                <Button variant="tertiary" onClick={() => setSelected(null)}>
                  Close
                </Button>
              </Flex>
            </Flex>
            <Typography textColor="neutral600">
              {`Locale: ${selected.targetLocale ?? 'default'}. Version: ${selected.targetStatus}. Finished: ${when(selected.finishedAt) || 'not finished'}.`}
            </Typography>
            <Box background="neutral100" padding={3} hasRadius>
              <Typography tag="pre" variant="pi">
                {JSON.stringify(selected.config, null, 2)}
              </Typography>
            </Box>
            {(selected.errors ?? []).slice(0, 50).map((error) => (
              <Typography key={error.row} textColor="danger600">
                {`Row ${error.row}: ${error.message}`}
              </Typography>
            ))}
            {(selected.errors?.length ?? 0) > 50 && (
              <Typography textColor="neutral600">Download the file to see every failed row.</Typography>
            )}
          </Flex>
        </Box>
      )}
    </Flex>
  );
};
