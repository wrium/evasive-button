import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    // e2e/ holds Playwright specs (real browser only) - exclude so vitest doesn't pick them up
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
    testTimeout: 10000,
  }
});
