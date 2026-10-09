/** Plugin options under `'csv-import-export'.config` in `config/plugins.ts`. */
export interface CsvImportExportConfig {
  /** Prefix formula-looking export cells with `'`. Default `true`. */
  escapeFormulas: boolean;
  /** Largest CSV, in MB, the import screen accepts. Default `10`. */
  maxFileSizeMb: number;
}

/** Defaults and validation for the plugin options. */
const config: {
  default: CsvImportExportConfig;
  validator(config: Record<string, unknown>): void;
} = {
  default: {
    escapeFormulas: true,
    maxFileSizeMb: 10,
  },
  validator(config: Record<string, unknown>) {
    if (typeof config.escapeFormulas !== 'boolean') {
      throw new Error('csv-import-export: escapeFormulas must be a boolean');
    }
    if (typeof config.maxFileSizeMb !== 'number' || config.maxFileSizeMb <= 0) {
      throw new Error('csv-import-export: maxFileSizeMb must be a positive number');
    }
  },
};

export default config;
