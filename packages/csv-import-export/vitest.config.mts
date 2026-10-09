import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['server/src/**/*.test.ts', 'admin/src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['json-summary', 'json', 'html-spa'],
      include: ['server/src/**', 'admin/src/**'],
    },
  },
});
