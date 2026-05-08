import path from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * Vitest for two kinds of unit tests:
 *
 *   1. Convex function tests (convex-test) under `src/convex/**`.
 *   2. Pure-TS presentation helpers colocated wherever their single
 *      consumer lives — today route-local under `src/routes/**` (e.g.
 *      `src/routes/auth/select-tenant/memberships.ts`'s
 *      `groupMembershipsByType`), promoted to `src/lib/queries/<entity>.ts`
 *      when a second consumer shows up (see `project-structure` rule 6).
 *      Either way, no browser, no Convex, no Playwright round-trip —
 *      just input → output.
 *
 * `environment: 'edge-runtime'` is load-bearing for category 1: convex-test
 * runs the same code Convex's cloud runtime runs, which is an Edge-runtime-
 * shaped env (Web globals, no node APIs). `@edge-runtime/vm` emulates that
 * so imports like `crypto.subtle`, `fetch`, and `Request` behave the way
 * they do in production. The pure-TS helpers don't care about the
 * environment, so running them under edge-runtime costs us nothing.
 *
 * `include` picks up `src/**`, `tests/**`, and `scripts/**` test files.
 * Playwright specs use `.spec.ts` so there is no collision with `.test.ts`.
 * Keep this in sync with `bunfig.toml`'s `[test].root` if we ever add a
 * bun-native suite; see `.agents/skills/testing/SKILL.md`.
 *
 * `passWithNoTests` means `bun run test` succeeds on an empty suite — a
 * trade-off we accept while the unit surface is small. Remove once we'd
 * rather have an empty run surface a missing import.
 */
export default defineConfig({
  // `$lib` / `$convex` are set up by the SvelteKit Vite plugin at dev/build
  // time; Vitest doesn't run through that plugin (it'd try to compile
  // `.svelte` files we never load from unit tests), so we mirror the two
  // aliases here by hand. Keep this block in sync with `svelte.config.js`
  // (`kit.alias`) and the default `$lib → src/lib` mapping.
  resolve: {
    alias: {
      $lib: path.resolve('./src/lib'),
      $convex: path.resolve('./src/convex'),
    },
  },
  test: {
    environment: 'edge-runtime',
    server: { deps: { inline: ['convex-test'] } },
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts', 'scripts/**/*.test.ts'],
    passWithNoTests: true,
  },
});
