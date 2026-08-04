import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // CLAUDE.md: tests are colocated as *.test.ts, for lib/ranking/ only.
    // url-state.ts is included too (Phase 4): it is pure parse/serialise code
    // with no DOM dependency, and its round-trip property backs acceptance
    // criterion 13 (PRD §7) directly. Still no React/DOM anywhere in this run.
    environment: 'node',
    include: ['src/lib/ranking/**/*.test.ts', 'src/lib/url-state.test.ts'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
