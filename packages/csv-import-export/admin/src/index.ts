/**
 * Admin panel side of the Strapi 5 CSV import/export plugin: the CSV Import /
 * Export page and the Import CSV and Export CSV buttons in the Content
 * Manager. Strapi's admin build loads it from the package's `strapi-admin`
 * export when the plugin is enabled:
 *
 * ```ts
 * // config/plugins.ts
 * export default () => ({
 *   'csv-import-export': { enabled: true },
 * });
 * ```
 *
 * @module
 */
import { ListViewActions } from './components/ListViewActions';
import { PluginIcon } from './components/PluginIcon';
import { PLUGIN_ID } from './pluginId';

/** What Strapi's admin loads from `strapi-admin`. */
export interface CsvImportExportAdmin {
  /** Adds the menu link and registers the plugin. */
  register(app: any): void;
  /** Adds the Import CSV and Export CSV buttons to the Content Manager list view. */
  bootstrap(app: any): void;
  /** Loads the plugin's translations for each admin locale. */
  registerTrads(context: { locales: string[] }): Promise<Array<{ data: Record<string, string>; locale: string }>>;
}

/** Admin entry for the CSV import/export plugin. */
const plugin: CsvImportExportAdmin = {
  register(app: any) {
    app.addMenuLink({
      to: `plugins/${PLUGIN_ID}`,
      icon: PluginIcon,
      intlLabel: { id: `${PLUGIN_ID}.plugin.name`, defaultMessage: 'CSV Import / Export' },
      Component: () => import('./pages/App'),
      permissions: [
        { action: `plugin::${PLUGIN_ID}.import`, subject: null },
        { action: `plugin::${PLUGIN_ID}.export`, subject: null },
      ],
    });

    app.registerPlugin({ id: PLUGIN_ID, name: PLUGIN_ID });
  },

  bootstrap(app: any) {
    app
      .getPlugin('content-manager')
      .injectComponent('listView', 'actions', { name: `${PLUGIN_ID}-actions`, Component: ListViewActions });
  },

  async registerTrads({ locales }: { locales: string[] }) {
    return Promise.all(
      locales.map(async (locale) => {
        try {
          const { default: data } = await import(`./translations/${locale}.json`);
          const prefixed = Object.fromEntries(
            Object.entries(data as Record<string, string>).map(([key, value]) => [
              `${PLUGIN_ID}.${key}`,
              value,
            ])
          );
          return { data: prefixed, locale };
        } catch {
          return { data: {}, locale };
        }
      })
    );
  },
};

export default plugin;
