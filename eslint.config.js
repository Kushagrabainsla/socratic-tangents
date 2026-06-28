import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

// Flat config. Type-unaware rules only (fast, no project service needed). Prettier owns formatting,
// so eslint-config-prettier disables any stylistic rules that would fight it.
export default tseslint.config(
  { ignores: ['.wxt/**', '.output/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
);
