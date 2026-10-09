import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

// Server code talks to Strapi's untyped runtime (strapi.contentTypes,
// strapi.documents results), so `any` is allowed at that boundary, as in admin-api.
export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['server/**/*.ts', 'scripts/**/*.mjs', '*.mjs', '*.mts'],
    languageOptions: {
      globals: { ...globals.node, strapi: 'readonly' },
    },
  },
  {
    files: ['admin/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    ignores: ['dist', 'node_modules', 'coverage'],
  }
);
