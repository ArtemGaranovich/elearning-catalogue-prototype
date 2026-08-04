import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  globalIgnores(['.next/**', 'out/**', 'build/**', 'coverage/**', 'next-env.d.ts']),

  {
    name: 'project/no-any',
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // CLAUDE.md conventions: TypeScript strict, no `any`.
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },

  {
    // CLAUDE.md hard constraint: no localStorage — view state lives in the URL.
    name: 'project/no-local-storage',
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'localStorage',
          message:
            'No localStorage (CLAUDE.md). View state lives in the URL — see lib/url-state.ts.',
        },
        {
          name: 'sessionStorage',
          message:
            'No web storage (CLAUDE.md). View state lives in the URL — see lib/url-state.ts.',
        },
      ],
    },
  },

  {
    // CLAUDE.md: everything in lib/ is pure — data in, data out. No React, no DOM,
    // no fetch. This is what makes the engine testable and the inspector possible.
    name: 'project/lib-is-pure',
    files: ['src/lib/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: 'src/lib must stay pure — no React (CLAUDE.md).' },
            { name: 'react-dom', message: 'src/lib must stay pure — no React (CLAUDE.md).' },
          ],
          patterns: [
            {
              group: ['next', 'next/*'],
              message: 'src/lib must stay pure — no framework imports.',
            },
            {
              group: ['@/components', '@/components/*'],
              message: 'src/lib must not depend on the UI.',
            },
          ],
        },
      ],
      // CLAUDE.md hard constraint: no Date.now() anywhere in scoring. A demo whose
      // planted cases decay with real time is a broken demo — use DATASET_AS_OF.
      'no-restricted-properties': [
        'error',
        {
          object: 'Date',
          property: 'now',
          message: 'Use DATASET_AS_OF (lib/ranking/constants.ts), never Date.now() — CLAUDE.md.',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message:
            'Use DATASET_AS_OF (lib/ranking/constants.ts), never the current clock — CLAUDE.md.',
        },
      ],
    },
  },
]);

export default eslintConfig;
