export default {
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
