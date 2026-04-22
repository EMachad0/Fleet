/// <reference types="vite/client" />

/**
 * Module map for `convex-test`. Every `*.test.ts` file in `src/convex/`
 * imports `modules` from here rather than inlining `import.meta.glob(…)`,
 * because the glob path is resolved relative to the file where it's called —
 * inlining would break the moment a test moved one directory up.
 *
 * The pattern `./**\/!(*.*.*)*.*s` matches files whose basename has exactly
 * one dot (i.e., `<name>.ts` or `<name>.js`), which excludes both
 * `<name>.test.ts` tests and this `test.setup.ts` file from the module map
 * convex-test hands to its runtime. See
 * https://docs.convex.dev/testing/convex-test.
 */
export const modules = import.meta.glob('./**/!(*.*.*)*.*s');
