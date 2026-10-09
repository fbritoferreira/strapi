import { ListViewActions } from './components/ListViewActions';
import { PluginIcon } from './components/PluginIcon';
import { PLUGIN_ID } from './pluginId';

export default {
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
