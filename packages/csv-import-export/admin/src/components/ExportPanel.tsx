import {
  Box,
  Button,
  Checkbox,
  Flex,
  IconButton,
  SingleSelect,
  SingleSelectOption,
  Table,
  Tbody,
  Td,
  TextInput,
  Th,
  Thead,
  Tr,
  Typography,
} from '@strapi/design-system';
import { ArrowDown, ArrowUp } from '@strapi/icons';
import { useNotification } from '@strapi/strapi/admin';
import { useEffect, useState } from 'react';

import { type CollectionType, errorMessage, type FieldDescription, useApi } from '../api';
import { defaultMatchOn, download } from '../utils/csv';
import { type Source, SourcePicker } from './SourcePicker';

interface Column {
  field: FieldDescription;
  header: string;
  include: boolean;
  matchOn?: string;
}

interface Props {
  contentTypes: CollectionType[];
  initialUid?: string;
}

export const ExportPanel = ({ contentTypes, initialUid }: Props) => {
  const api = useApi();
  const { toggleNotification } = useNotification();
  const [source, setSource] = useState<Source>({ uid: initialUid ?? '', status: 'published' });
  const [columns, setColumns] = useState<Column[]>([]);
  const [targets, setTargets] = useState<Record<string, FieldDescription[]>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (initialUid) setSource((s) => ({ ...s, uid: initialUid }));
  }, [initialUid]);

  // Default columns: documentId and every scalar field, relations and media off.
  useEffect(() => {
    if (!source.uid) return;
    let current = true;
    (async () => {
      const all = await api.schema(source.uid);
      // A relation whose target the user cannot read is left out.
      const targetEntries = await Promise.all(
        all
          .filter((f) => f.type === 'relation')
          .map(async (f) => [f.name, await api.schema(f.relation!.target).catch(() => null)] as const)
      );
      const relationTargets = Object.fromEntries(targetEntries.filter(([, t]) => t !== null)) as Record<
        string,
        FieldDescription[]
      >;
      const fields = all.filter((f) => f.type !== 'relation' || relationTargets[f.name]);
      if (!current) return;
      setTargets(relationTargets);
      setColumns(
        fields.map((field) => ({
          field,
          header: field.name,
          include: field.type !== 'relation' && field.type !== 'media',
          matchOn: field.type === 'relation' ? defaultMatchOn(relationTargets[field.name] ?? []) : undefined,
        }))
      );
    })().catch((error) => toggleNotification({ type: 'danger', message: errorMessage(error) }));
    return () => {
      current = false;
    };
  }, [api, source.uid, toggleNotification]);

  const update = (index: number, patch: Partial<Column>) =>
    setColumns(columns.map((column, i) => (i === index ? { ...column, ...patch } : column)));

  const move = (index: number, by: -1 | 1) => {
    const next = [...columns];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    setColumns(next);
  };

  const selected = columns.filter((c) => c.include);

  const runExport = async () => {
    setBusy(true);
    try {
      const { fileName, rowCount, csv } = await api.exportCsv(source.uid, {
        locale: source.locale,
        status: source.status,
        columns: selected.map((c) => ({ field: c.field.name, header: c.header, matchOn: c.matchOn })),
      });
      download(fileName, csv);
      toggleNotification({ type: 'success', message: `Exported ${rowCount} rows.` });
    } catch (error) {
      toggleNotification({ type: 'danger', message: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box background="neutral0" padding={6} shadow="filterShadow" hasRadius>
      <Flex direction="column" alignItems="stretch" gap={4}>
        <SourcePicker contentTypes={contentTypes} value={source} onChange={setSource} statusLabel="Export version" />
        {columns.length > 0 && (
          <Table colCount={5} rowCount={columns.length + 1}>
            <Thead>
              <Tr>
                <Th>
                  <Typography variant="sigma">Include</Typography>
                </Th>
                <Th>
                  <Typography variant="sigma">Field</Typography>
                </Th>
                <Th>
                  <Typography variant="sigma">CSV header</Typography>
                </Th>
                <Th>
                  <Typography variant="sigma">Relation value</Typography>
                </Th>
                <Th>
                  <Typography variant="sigma">Order</Typography>
                </Th>
              </Tr>
            </Thead>
            <Tbody>
              {columns.map((column, i) => (
                <Tr key={column.field.name}>
                  <Td>
                    <Checkbox
                      aria-label={`Include ${column.field.name}`}
                      checked={column.include}
                      onCheckedChange={(checked: boolean | 'indeterminate') => update(i, { include: checked === true })}
                    />
                  </Td>
                  <Td>
                    <Typography>{`${column.field.name} (${column.field.type})`}</Typography>
                  </Td>
                  <Td>
                    <TextInput
                      aria-label={`Header for ${column.field.name}`}
                      value={column.header}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => update(i, { header: e.target.value })}
                    />
                  </Td>
                  <Td>
                    {column.field.type === 'relation' && (
                      <SingleSelect
                        aria-label={`${column.field.name} value`}
                        value={column.matchOn}
                        onChange={(matchOn: string | number) => update(i, { matchOn: String(matchOn) })}
                      >
                        {(targets[column.field.name] ?? [])
                          .filter((t) => t.type !== 'relation' && t.type !== 'media')
                          .map((t) => (
                            <SingleSelectOption key={t.name} value={t.name}>
                              {t.name}
                            </SingleSelectOption>
                          ))}
                      </SingleSelect>
                    )}
                    {column.field.type === 'media' && <Typography textColor="neutral600">file URL</Typography>}
                  </Td>
                  <Td>
                    <Flex gap={1}>
                      <IconButton label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                        <ArrowUp />
                      </IconButton>
                      <IconButton label="Move down" disabled={i === columns.length - 1} onClick={() => move(i, 1)}>
                        <ArrowDown />
                      </IconButton>
                    </Flex>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
        <Flex justifyContent="flex-end">
          <Button
            loading={busy}
            disabled={!source.uid || selected.length === 0 || selected.some((c) => c.header.trim() === '')}
            onClick={runExport}
          >
            Export {selected.length} columns
          </Button>
        </Flex>
      </Flex>
    </Box>
  );
};
