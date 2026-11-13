import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/*.cjs', 'apps/mobile/*.js', '**/node_modules/**', '**/dist/**', '**/build/**', 'apps/mobile/ios/**', 'apps/mobile/android/**', 'supabase/functions/**/vendor/**', '**/coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Edge Functions log structured JSON through console.log. Tests read loosely typed JSON responses.
    files: ['supabase/functions/**/*.ts', 'supabase/tests/**/*.ts', 'scripts/**/*.ts'],
    rules: { 'no-console': 'off', '@typescript-eslint/no-explicit-any': 'off' },
  },
);
