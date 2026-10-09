import { Tabs } from '@strapi/design-system';
import { Layouts, Page, useNotification } from '@strapi/strapi/admin';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { type CollectionType, errorMessage, useApi } from '../api';
import { ExportPanel } from '../components/ExportPanel';
import { History } from '../components/History';
import { ImportWizard } from '../components/ImportWizard';

type Tab = 'import' | 'export' | 'history';

const App = () => {
  const api = useApi();
  const { toggleNotification } = useNotification();
  const [params, setParams] = useSearchParams();
  const [contentTypes, setContentTypes] = useState<CollectionType[] | null>(null);
  const [maxFileSizeMb, setMaxFileSizeMb] = useState(10);

  const tab = (['import', 'export', 'history'].includes(params.get('tab') ?? '') ? params.get('tab') : 'import') as Tab;
  const uid = params.get('uid') ?? undefined;
  const setTab = (next: string) => setParams({ tab: next, ...(uid ? { uid } : {}) });

  useEffect(() => {
    api
      .contentTypes()
      .then(({ data, meta }) => {
        setContentTypes(data);
        setMaxFileSizeMb(meta.maxFileSizeMb);
      })
      .catch((error) => {
        setContentTypes([]);
        toggleNotification({ type: 'danger', message: errorMessage(error) });
      });
  }, [api, toggleNotification]);

  if (!contentTypes) return <Page.Loading />;

  return (
    <Page.Main>
      <Page.Title>CSV Import / Export</Page.Title>
      <Layouts.Header
        title="CSV Import / Export"
        subtitle="Import rows into a collection, matching existing entries, or export a collection as CSV."
      />
      <Layouts.Content>
        <Tabs.Root value={tab} onValueChange={setTab}>
          <Tabs.List aria-label="CSV import and export">
            <Tabs.Trigger value="import">Import</Tabs.Trigger>
            <Tabs.Trigger value="export">Export</Tabs.Trigger>
            <Tabs.Trigger value="history">History</Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value="import">
            <ImportWizard
              contentTypes={contentTypes}
              maxFileSizeMb={maxFileSizeMb}
              initialUid={uid}
              onShowHistory={() => setTab('history')}
            />
          </Tabs.Content>
          <Tabs.Content value="export">
            <ExportPanel contentTypes={contentTypes} initialUid={uid} />
          </Tabs.Content>
          <Tabs.Content value="history">
            <History contentTypes={contentTypes} />
          </Tabs.Content>
        </Tabs.Root>
      </Layouts.Content>
    </Page.Main>
  );
};

export { App };
export default App;
