/// <reference types="vite/client" />

/**
 * Module map for `convex-test`. Every `*.test.ts` file in `src/convex/`
 * imports `modules` from here rather than inlining `import.meta.glob(…)`,
 * because the glob path is resolved relative to the file where it's called —
 * inlining would break the moment a test moved one directory up.
 *
 * Keep `_generated/*.js` included: convex-test resolves API references via
 * those files and fails fast if they are missing. Exclude test files and
 * TypeScript declarations from the runtime module graph.
 */
export const modules = import.meta.glob([
  './**/*.ts',
  './**/*.js',
  '!./**/*.test.ts',
  '!./**/*.d.ts',
  '!./test.setup.ts',
  '!./_components/*/_generated/**',
]);
