import {
  Badge,
  Box,
  Button,
  Field,
  Flex,
  ProgressBar,
  SingleSelect,
  SingleSelectOption,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  Typography,
} from '@strapi/design-system';
import { useNotification } from '@strapi/strapi/admin';
import { useEffect, useRef, useState } from 'react';

import {
  type CollectionType,
  errorMessage,
  type FieldDescription,
  type ImportConfig,
  type ImportRequest,
  type ImportResult,
  useApi,
} from '../api';
import {
  autoMap,
  chunk,
  defaultMatchOn,
  download,
  type Failure,
  failuresToCsv,
  mappingProblems,
  type ParsedCsv,
  parseCsv,
  sameHeaders,
} from '../utils/csv';
import { Notice } from './Notice';
import { type Source, SourcePicker } from './SourcePicker';

const BATCH_SIZE = 100;
const PREVIEW_ROWS = 20;

type Step = 'source' | 'mapping' | 'preview' | 'run';

interface RunState {
  state: 'running' | 'completed' | 'failed' | 'cancelled';
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  errored: number;
  failures: Failure[];
  message?: string;
  jobId?: number;
}

const ACTION_BADGE: Record<string, { label: string; color: string }> = {
  created: { label: 'create', color: 'success600' },
  updated: { label: 'update', color: 'primary600' },
  skipped: { label: 'skip', color: 'warning600' },
  error: { label: 'error', color: 'danger600' },
};

interface Props {
  contentTypes: CollectionType[];
  maxFileSizeMb: number;
  initialUid?: string;
  onShowHistory: () => void;
}

export const ImportWizard = ({ contentTypes, maxFileSizeMb, initialUid, onShowHistory }: Props) => {
  const api = useApi();
  const { toggleNotification } = useNotification();

  const [step, setStep] = useState<Step>('source');
  const [source, setSource] = useState<Source>({ uid: initialUid ?? '', status: 'draft' });
  const [fileName, setFileName] = useState('');
  const [csv, setCsv] = useState<ParsedCsv | null>(null);
  const [fileError, setFileError] = useState('');

  const [fields, setFields] = useState<FieldDescription[]>([]);
  const [targets, setTargets] = useState<Record<string, FieldDescription[]>>({});
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [matchField, setMatchField] = useState('documentId');
  const [relations, setRelations] = useState<ImportRequest['relations']>({});
  const [onMissingRelation, setOnMissingRelation] = useState<ImportRequest['onMissingRelation']>('skip');
  const [prefilled, setPrefilled] = useState(false);

  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [run, setRun] = useState<RunState | null>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    if (initialUid) setSource((s) => ({ ...s, uid: initialUid }));
  }, [initialUid]);

  const onFile = async (file: File | undefined) => {
    setCsv(null);
    setFileError('');
    if (!file) return;
    if (file.size > maxFileSizeMb * 1024 * 1024) {
      setFileError(`The file is larger than ${maxFileSizeMb} MB.`);
      return;
    }
    const parsed = parseCsv(await file.text());
    if ('error' in parsed) {
      setFileError(`This file cannot be read: ${parsed.error}.`);
      return;
    }
    setFileName(file.name);
    setCsv(parsed);
  };

  /** Loads the schema and relation targets, then maps columns from an earlier import or by name. */
  const goToMapping = async () => {
    if (!csv) return;
    try {
      const all = await api.schema(source.uid);
      // A relation whose target the user cannot read is left out of the mapping.
      const targetEntries = await Promise.all(
        all
          .filter((f) => f.type === 'relation')
          .map(async (f) => [f.name, await api.schema(f.relation!.target).catch(() => null)] as const)
      );
      const hidden = new Set(targetEntries.filter(([, t]) => t === null).map(([name]) => name));
      const targetMap = Object.fromEntries(targetEntries.filter(([, t]) => t !== null)) as Record<
        string,
        FieldDescription[]
      >;
      const schema = all.filter((f) => !hidden.has(f.name));
      const relationFields = schema.filter((f) => f.type === 'relation');

      const history = await api.jobs({ page: 1, pageSize: 20, uid: source.uid, kind: 'import' });
      const previous = history.data.find((job) => job.config?.headers && sameHeaders(job.config.headers, csv.headers));

      const nextMapping = (previous?.config?.mapping as Record<string, string> | undefined)
        ? { ...Object.fromEntries(csv.headers.map((h) => [h, ''])), ...previous!.config!.mapping }
        : autoMap(csv.headers, schema);
      const mappedNames = Object.values(nextMapping);
      const nextRelations = Object.fromEntries(
        relationFields.map((f) => [
          f.name,
          { matchOn: previous?.config?.relations?.[f.name]?.matchOn ?? defaultMatchOn(targetMap[f.name] ?? []) },
        ])
      );

      setFields(schema);
      setTargets(targetMap);
      setMapping(nextMapping);
      setRelations(nextRelations);
      setMatchField(
        previous?.config?.matchField ??
          (mappedNames.includes('documentId')
            ? 'documentId'
            : (schema.find((f) => f.unique && mappedNames.includes(f.name))?.name ?? 'documentId'))
      );
      setOnMissingRelation(previous?.config?.onMissingRelation ?? 'skip');
      setPrefilled(Boolean(previous));
      setStep('mapping');
    } catch (error) {
      toggleNotification({ type: 'danger', message: errorMessage(error) });
    }
  };

  const config = (): ImportConfig => ({
    headers: csv?.headers ?? [],
    matchField,
    mapping: Object.fromEntries(Object.entries(mapping).filter(([, name]) => name !== '')),
    relations: Object.fromEntries(
      Object.entries(relations).filter(([name]) => Object.values(mapping).includes(name))
    ),
    onMissingRelation,
  });

  const request = (rows: Record<string, string>[], rowOffset: number, dryRun: boolean, jobId?: number): ImportRequest => {
    const { mapping: mapped, relations: rel } = config();
    return {
      locale: source.locale,
      status: source.status,
      matchField,
      mapping: mapped,
      relations: rel,
      onMissingRelation,
      dryRun,
      jobId,
      rowOffset,
      rows,
    };
  };

  const goToPreview = async () => {
    if (!csv) return;
    try {
      setPreview(await api.importBatch(source.uid, request(csv.rows.slice(0, BATCH_SIZE), 0, true)));
      setStep('preview');
    } catch (error) {
      toggleNotification({ type: 'danger', message: errorMessage(error) });
    }
  };

  const startImport = async () => {
    if (!csv) return;
    cancelled.current = false;
    setStep('run');
    const state: RunState = {
      state: 'running',
      processed: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errored: 0,
      failures: [],
    };
    setRun({ ...state });

    let jobId: number;
    try {
      jobId = (
        await api.createJob({
          uid: source.uid,
          locale: source.locale,
          status: source.status,
          fileName,
          totalRows: csv.rows.length,
          config: config(),
        })
      ).id;
    } catch (error) {
      setRun({ ...state, state: 'failed', message: errorMessage(error) });
      return;
    }
    state.jobId = jobId;

    const stop = async (final: RunState['state'], message?: string) => {
      await api.finishJob(jobId, final === 'completed' ? 'completed' : 'failed').catch(() => undefined);
      setRun({ ...state, state: final, message });
    };

    for (const batch of chunk(csv.rows, BATCH_SIZE)) {
      if (cancelled.current) {
        await stop('cancelled', `Stopped after ${state.processed} rows. Those rows stay imported.`);
        return;
      }

      const body = request(batch, state.processed, false, jobId);
      let result: ImportResult;
      // No automatic retry: a request that timed out may still have written its rows,
      // and resending rows without a match value would create them twice.
      try {
        result = await api.importBatch(source.uid, body);
      } catch (error) {
        await stop(
          'failed',
          `Rows ${state.processed + 1} to ${state.processed + batch.length} failed: ${errorMessage(error)}. ` +
            'Some of them may have been written. Earlier rows stay imported; importing the file again updates the rows that match.'
        );
        return;
      }

      for (const r of result.results) {
        if (r.action === 'created') state.created += 1;
        if (r.action === 'updated') state.updated += 1;
        if (r.action === 'skipped') state.skipped += 1;
        if (r.action === 'error') state.errored += 1;
        if (r.error) state.failures.push({ row: r.row, data: csv.rows[r.row - 1], message: r.error });
      }
      state.processed += batch.length;
      setRun({ ...state, failures: [...state.failures] });

      if (result.aborted) {
        await stop(
          'failed',
          `A relation target is missing in rows ${state.processed - batch.length + 1} to ${state.processed}, so nothing in that batch was written. Earlier rows stay imported.`
        );
        return;
      }
    }
    await stop('completed');
  };

  const reset = () => {
    setStep('source');
    setCsv(null);
    setFileName('');
    setPreview(null);
    setRun(null);
  };

  const problems = mappingProblems(fields, config());
  const uniqueFields = fields.filter((f) => f.unique);

  return (
    <Box background="neutral0" padding={6} shadow="filterShadow" hasRadius>
      {step === 'source' && (
        <Flex direction="column" alignItems="stretch" gap={4}>
          <SourcePicker contentTypes={contentTypes} value={source} onChange={setSource} statusLabel="Save entries as" />
          <Field.Root name="file" error={fileError} hint={`CSV with a header row, up to ${maxFileSizeMb} MB.`}>
            <Field.Label>CSV file</Field.Label>
            <input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} />
            <Field.Hint />
            <Field.Error />
          </Field.Root>
          {csv && (
            <Typography textColor="neutral600">
              {fileName}: {csv.rows.length} rows, {csv.headers.length} columns.
            </Typography>
          )}
          <Flex justifyContent="flex-end">
            <Button disabled={!csv || !source.uid} onClick={goToMapping}>
              Map columns
            </Button>
          </Flex>
        </Flex>
      )}

      {step === 'mapping' && csv && (
        <Flex direction="column" alignItems="stretch" gap={4}>
          {prefilled && (
            <Notice variant="default" title="Mapping restored">
              This file has the same columns as an earlier import, so its mapping was reused.
            </Notice>
          )}
          <Table colCount={4} rowCount={csv.headers.length + 1}>
            <Thead>
              <Tr>
                <Th>
                  <Typography variant="sigma">CSV column</Typography>
                </Th>
                <Th>
                  <Typography variant="sigma">First value</Typography>
                </Th>
                <Th>
                  <Typography variant="sigma">Field</Typography>
                </Th>
                <Th>
                  <Typography variant="sigma">Relation matches on</Typography>
                </Th>
              </Tr>
            </Thead>
            <Tbody>
              {csv.headers.map((header) => {
                const field = fields.find((f) => f.name === mapping[header]);
                return (
                  <Tr key={header}>
                    <Td>
                      <Typography fontWeight="bold">{header}</Typography>
                    </Td>
                    <Td>
                      <Typography textColor="neutral600" ellipsis>
                        {csv.rows[0]?.[header]}
                      </Typography>
                    </Td>
                    <Td>
                      <SingleSelect
                        aria-label={`Field for ${header}`}
                        value={mapping[header] || '__ignore'}
                        onChange={(name: string | number) =>
                          setMapping({ ...mapping, [header]: name === '__ignore' ? '' : String(name) })
                        }
                      >
                        <SingleSelectOption value="__ignore">Ignore this column</SingleSelectOption>
                        {fields.map((f) => (
                          <SingleSelectOption key={f.name} value={f.name}>
                            {`${f.name} (${f.type}${f.required ? ', required' : ''})`}
                          </SingleSelectOption>
                        ))}
                      </SingleSelect>
                    </Td>
                    <Td>
                      {field?.type === 'relation' && (
                        <SingleSelect
                          aria-label={`${field.name} matches on`}
                          value={relations[field.name]?.matchOn}
                          onChange={(matchOn: string | number) =>
                            setRelations({ ...relations, [field.name]: { matchOn: String(matchOn) } })
                          }
                        >
                          {(targets[field.name] ?? [])
                            .filter((t) => t.type !== 'relation' && t.type !== 'media')
                            .map((t) => (
                              <SingleSelectOption key={t.name} value={t.name}>
                                {t.name}
                              </SingleSelectOption>
                            ))}
                        </SingleSelect>
                      )}
                      {field?.type === 'media' && <Typography textColor="neutral600">file URL or name</Typography>}
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>

          <Flex gap={4} alignItems="flex-start">
            <Field.Root name="matchField" hint="Rows whose value matches an existing entry update it; the rest create new entries.">
              <Field.Label>Find existing entries by</Field.Label>
              <SingleSelect value={matchField} onChange={(name: string | number) => setMatchField(String(name))}>
                {uniqueFields.map((f) => (
                  <SingleSelectOption key={f.name} value={f.name}>
                    {f.name}
                  </SingleSelectOption>
                ))}
              </SingleSelect>
              <Field.Hint />
            </Field.Root>
            <Field.Root name="onMissingRelation" hint="What happens when a relation value matches no entry.">
              <Field.Label>Missing relation</Field.Label>
              <SingleSelect
                value={onMissingRelation}
                onChange={(v: string | number) => setOnMissingRelation(v as ImportRequest['onMissingRelation'])}
              >
                <SingleSelectOption value="skip">Skip the row</SingleSelectOption>
                <SingleSelectOption value="fail">Stop the import</SingleSelectOption>
              </SingleSelect>
              <Field.Hint />
            </Field.Root>
          </Flex>

          {problems.errors.length > 0 && (
            <Notice key={problems.errors.join()} variant="danger" title="Fix the mapping">
              {problems.errors.join(' ')}
            </Notice>
          )}
          {problems.warnings.length > 0 && (
            <Notice key={problems.warnings.join()} variant="warning" title="Check the mapping">
              {problems.warnings.join(' ')}
            </Notice>
          )}

          <Flex justifyContent="space-between">
            <Button variant="tertiary" onClick={() => setStep('source')}>
              Back
            </Button>
            <Button disabled={problems.errors.length > 0} onClick={goToPreview}>
              Preview
            </Button>
          </Flex>
        </Flex>
      )}

      {step === 'preview' && csv && preview && (
        <Flex direction="column" alignItems="stretch" gap={4}>
          <Typography>
            Dry run of the first {Math.min(BATCH_SIZE, csv.rows.length)} of {csv.rows.length} rows:{' '}
            {preview.results.filter((r) => r.action === 'created').length} create,{' '}
            {preview.results.filter((r) => r.action === 'updated').length} update,{' '}
            {preview.results.filter((r) => r.action === 'skipped').length} skip,{' '}
            {preview.results.filter((r) => r.action === 'error').length} error. Nothing has been written yet.
          </Typography>
          <Table colCount={4} rowCount={Math.min(PREVIEW_ROWS, preview.results.length) + 1}>
            <Thead>
              <Tr>
                <Th>
                  <Typography variant="sigma">Row</Typography>
                </Th>
                <Th>
                  <Typography variant="sigma">Action</Typography>
                </Th>
                <Th>
                  <Typography variant="sigma">{matchField}</Typography>
                </Th>
                <Th>
                  <Typography variant="sigma">Problem</Typography>
                </Th>
              </Tr>
            </Thead>
            <Tbody>
              {preview.results.slice(0, PREVIEW_ROWS).map((r) => {
                const column = Object.keys(mapping).find((h) => mapping[h] === matchField);
                return (
                  <Tr key={r.row}>
                    <Td>
                      <Typography>{r.row}</Typography>
                    </Td>
                    <Td>
                      <Badge textColor={ACTION_BADGE[r.action].color}>{ACTION_BADGE[r.action].label}</Badge>
                    </Td>
                    <Td>
                      <Typography>{column ? csv.rows[r.row - 1]?.[column] : ''}</Typography>
                    </Td>
                    <Td>
                      <Typography textColor="danger600">{r.error}</Typography>
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
          <Flex justifyContent="space-between">
            <Button variant="tertiary" onClick={() => setStep('mapping')}>
              Back
            </Button>
            <Button onClick={startImport}>Import {csv.rows.length} rows</Button>
          </Flex>
        </Flex>
      )}

      {step === 'run' && csv && run && (
        <Flex direction="column" alignItems="stretch" gap={4}>
          <ProgressBar value={Math.round((run.processed / csv.rows.length) * 100)} />
          <Typography>
            {run.processed} of {csv.rows.length} rows: {run.created} created, {run.updated} updated, {run.skipped}{' '}
            skipped, {run.errored} errors.
          </Typography>
          {run.state === 'completed' && (
            <Notice variant="success" title="Import finished">
              {run.failures.length === 0 ? 'Every row was imported.' : 'Download the error file to fix and re-import the rows that failed.'}
            </Notice>
          )}
          {(run.state === 'failed' || run.state === 'cancelled') && (
            <Notice variant="danger" title={run.state === 'failed' ? 'Import stopped' : 'Import cancelled'}>
              {run.message}
            </Notice>
          )}
          <Flex gap={2} justifyContent="flex-end">
            {run.state === 'running' && (
              <Button variant="danger-light" onClick={() => (cancelled.current = true)}>
                Cancel
              </Button>
            )}
            {run.state !== 'running' && run.failures.length > 0 && (
              <Button
                variant="secondary"
                onClick={() => download(`errors-${fileName}`, failuresToCsv(csv.headers, run.failures))}
              >
                Download {run.failures.length} failed rows
              </Button>
            )}
            {run.state !== 'running' && (
              <>
                <Button variant="tertiary" onClick={onShowHistory}>
                  View history
                </Button>
                <Button onClick={reset}>Import another file</Button>
              </>
            )}
          </Flex>
        </Flex>
      )}
    </Box>
  );
};
