export const ACTIONS = {
  import: 'plugin::csv-import-export.import',
  export: 'plugin::csv-import-export.export',
};

/** Registers the two plugin permissions shown under Settings > Roles > Plugins. */
export default async ({ strapi }: { strapi: any }) => {
  await strapi.service('admin::permission').actionProvider.registerMany([
    { section: 'plugins', displayName: 'Import CSV', uid: 'import', pluginName: 'csv-import-export' },
    { section: 'plugins', displayName: 'Export CSV', uid: 'export', pluginName: 'csv-import-export' },
  ]);
};
