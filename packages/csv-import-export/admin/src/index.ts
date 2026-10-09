import { PLUGIN_ID } from './pluginId';
import { PluginIcon } from './components/PluginIcon';

export default {
  register(app: any) {
    app.addMenuLink({
      to: `plugins/${PLUGIN_ID}`,
      icon: PluginIcon,
      intlLabel: { id: `${PLUGIN_ID}.plugin.name`, defaultMessage: 'CSV Import / Export' },
      Component: () => import('./pages/App'),
      permissions: [],
    });

    app.registerPlugin({ id: PLUGIN_ID, name: PLUGIN_ID });
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
