import { defineConfig } from 'vitest/config';

// Separate from vite.config.ts on purpose: the app config pulls in the React plugin and
// other build-only concerns the test runner doesn't need. Engine tests are plain
// TypeScript with no DOM, so the default (node) environment is enough and keeps runs fast.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
