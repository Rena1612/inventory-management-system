import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

/**
 * Flat config replacing `next lint`, which is deprecated in Next 15.5 and removed
 * in 16. `eslint-config-next` still ships eslintrc-style presets, so FlatCompat
 * bridges them into the flat config that the ESLint CLI expects.
 */
const config = [
  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      // The app leans on explicit prop types; an unused import is the one class
      // of sloppiness worth failing a build over.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
];

export default config;