import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      'packages/api-contract/src/schema.d.ts',
      '.specify/**',
      'specs/**',
      '.github/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['*.mjs', '*/*.cjs'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // HTTP test clients (supertest, mocked fetch) return untyped bodies.
    files: ['**/tests/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },
  {
    files: ['**/*.cjs', '**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    files: ['frontend/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
    },
  },
  {
    files: ['backend/src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: ['express', 'pg', 'pino', 'pino-http', 'node-pg-migrate'],
          patterns: ['**/infrastructure/**', '**/http/**'],
        },
      ],
    },
  },
  prettier,
);
