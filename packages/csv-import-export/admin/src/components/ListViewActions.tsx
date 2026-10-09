import { Button } from '@strapi/design-system';
import { Download, Upload } from '@strapi/icons';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { PLUGIN_ID } from '../pluginId';

/** Import / Export buttons in the Content Manager list view header, preselecting the collection. */
export const ListViewActions = () => {
  const { slug } = useParams<{ slug: string }>();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  if (!slug || !pathname.includes('/collection-types/')) return null;

  const go = (tab: 'import' | 'export') =>
    navigate(`/plugins/${PLUGIN_ID}?tab=${tab}&uid=${encodeURIComponent(slug)}`);

  return (
    <>
      <Button variant="tertiary" startIcon={<Upload />} onClick={() => go('import')}>
        Import CSV
      </Button>
      <Button variant="tertiary" startIcon={<Download />} onClick={() => go('export')}>
        Export CSV
      </Button>
    </>
  );
};
