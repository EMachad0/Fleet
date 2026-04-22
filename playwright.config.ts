import { defineConfig, devices } from '@playwright/test';
import { requireEnv } from './tests/support/env';

/**
 * See `.agents/skills/testing/SKILL.md` for the end-to-end testing strategy
 * this config implements (per-test fixtures, parallel-by-default, single
 * Convex dev deployment shared by all workers).
 *
 * A few choices worth re-reading the skill before changing:
 *   - `testDir: 'tests'` + `.spec.ts` keeps E2E separate from Vitest's
 *     `.test.ts` unit suite next to `src/convex/*`. Spec files mirror the
 *     route they exercise (`tests/routes/auth/logout/logout.spec.ts`
 *     covers `src/routes/auth/logout/+page.svelte`).
 *   - `fullyParallel: true` only works because every test allocates its own
 *     user (see `tests/support/fixtures.ts`). If that ever changes, drop
 *     parallelism here last, not first — the isolation is the real fix.
 *   - `webServer` boots `bun run dev`. It does NOT boot `bunx convex dev`:
 *     keep Convex running in another terminal so its DB state outlives the
 *     test run, and every Playwright worker hits that same deployment.
 *   - `baseURL` comes from `PUBLIC_SITE_URL` with no fallback. A missing
 *     env var is a config error, not a "default to localhost" situation.
 */
const baseURL = requireEnv('PUBLIC_SITE_URL');

export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  workers: process.env.CI ? 4 : '50%',
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',

  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: {
    command: 'bun run dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
