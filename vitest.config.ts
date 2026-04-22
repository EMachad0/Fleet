import { defineConfig } from 'vitest/config';

/**
 * Vitest for Convex unit tests (convex-test). See `.agents/skills/testing`.
 *
 * `environment: 'edge-runtime'` is load-bearing: convex-test runs the same
 * code that Convex's cloud runtime runs, which is an Edge-runtime-shaped env
 * (Web globals, no node APIs). `@edge-runtime/vm` emulates that inside
 * Vitest so imports like `crypto.subtle`, `fetch`, and `Request` behave the
 * way they do in production.
 *
 * `include` is narrow on purpose — it keeps Playwright's `tests/**` files
 * (`.spec.ts`) invisible to Vitest even if a stray glob ever misfires.
 *
 * `passWithNoTests` means `bun run test` succeeds on an empty suite. Useful
 * while the unit test surface is small; remove once there's always at least
 * one test and you'd rather have an empty run surface a missing import.
 */
export default defineConfig({
  test: {
    environment: 'edge-runtime',
    server: { deps: { inline: ['convex-test'] } },
    include: ['src/convex/**/*.test.ts'],
    passWithNoTests: true,
  },
});
