import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default tseslint.config(
  { ignores: ['dist', 'electron', 'scripts', '*.cjs'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  // shadcn/ui components — vendor patterns that use `any` and co-export variants
  {
    files: ['src/components/ui/**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'react-refresh/only-export-components': 'off',
    },
  },
  // Files that export helpers alongside components
  {
    files: [
      'src/components/app-shell/shared/controls.tsx',
      'src/app/routes/sections.tsx',
      'src/components/embedded-agent/EmbeddedAgentProvider.tsx',
    ],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
)
