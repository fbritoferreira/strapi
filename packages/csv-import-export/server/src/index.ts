/**
 * Server side of the Strapi 5 CSV import/export plugin. Strapi loads it from
 * the package's `strapi-server` export once the plugin is enabled:
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
import bootstrap from './bootstrap';
import type { CsvImportExportConfig } from './config';
import type { CsvController } from './controllers/csv';
import type { CsvRoute } from './routes';
import config from './config';
import contentTypes from './content-types';
import controllers from './controllers';
import routes from './routes';

/** What Strapi loads from `strapi-server`: lifecycle hooks and registries. */
export interface CsvImportExportServer {
  /** Strapi register lifecycle; does nothing. */
  register(): void;
  /** Registers the plugin's import and export permissions. */
  bootstrap(context: { strapi: any }): Promise<void>;
  /** Strapi destroy lifecycle; does nothing. */
  destroy(): void;
  /** Option defaults and validation. */
  config: { default: CsvImportExportConfig; validator(config: Record<string, unknown>): void };
  /** The `job` content type that logs imports and exports. */
  contentTypes: { job: { schema: Record<string, unknown> } };
  /** The `csv` controller factory. */
  controllers: { csv: (context: { strapi: any }) => CsvController };
  /** The admin routes. */
  routes: { admin: { type: string; routes: CsvRoute[] } };
  /** No services: the controller calls plain modules. */
  services: Record<string, never>;
  /** No policies beyond Strapi's admin ones. */
  policies: Record<string, never>;
  /** No middlewares. */
  middlewares: Record<string, never>;
}

/** Server entry for the CSV import/export plugin. */
const plugin: CsvImportExportServer = {
  register() {},
  bootstrap,
  destroy() {},
  config,
  contentTypes,
  controllers,
  routes,
  services: {},
  policies: {},
  middlewares: {},
};

export default plugin;

export type { CsvController, CsvImportExportConfig, CsvRoute };
