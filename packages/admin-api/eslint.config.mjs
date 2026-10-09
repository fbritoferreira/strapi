import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

// Plugin code targets Strapi's semi-internal APIs (admin::user, admin::token)
// which don't ship public types — `any` is unavoidable at the boundary.
export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        strapi: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    ignores: ['dist', 'node_modules', 'docs/.vitepress/**'],
  }
);
