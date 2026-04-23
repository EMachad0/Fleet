import { defineConfig, devices } from '@playwright/test';
import { requireEnv } from './tests/support/env';

/**
 * See `.agents/skills/testing/SKILL.md` for the end-to-end testing strategy
 * this config implements (per-test fixtures, parallel-by-default, single
 * isolated backend shared by all workers in the run).
 *
 * A few choices worth re-reading the skill before changing:
 *   - `testDir: 'tests'` + `.spec.ts` keeps E2E separate from Vitest's
 *     `.test.ts` unit suite next to `src/convex/*`. Spec files mirror the
 *     route they exercise (`tests/routes/auth/logout/logout.spec.ts`
 *     covers `src/routes/auth/logout/+page.svelte`).
 *   - `fullyParallel: true` only works because every test allocates its own
 *     user (see `tests/support/fixtures.ts`). If that ever changes, drop
 *     parallelism here last, not first — the isolation is the real fix.
 *   - `scripts/run-e2e-isolated.ts` boots a disposable self-hosted Convex
 *     backend, pushes the current functions into it once, and injects fresh
 *     per-run URLs before Playwright starts. `webServer` only owns the Vite
 *     dev server.
 *   - `reuseExistingServer: false` is deliberate. Reusing an already-running
 *     local dev server would point the suite at whatever backend that process
 *     was started with, which defeats run isolation.
 *   - `baseURL` comes from `PUBLIC_SITE_URL` with no fallback. A missing
 *     env var is a config error, not a "default to localhost" situation.
 */
const baseURL = requireEnv('PUBLIC_SITE_URL');
const devServerUrl = new URL(baseURL);
const devServerPort = devServerUrl.port || (devServerUrl.protocol === 'https:' ? '443' : '80');
const devServerCommand = `bun run dev -- --host ${devServerUrl.hostname} --port ${devServerPort}`;

export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  workers: process.env.CI ? 4 : '100%',
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',

  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: {
    command: devServerCommand,
    url: baseURL,
    reuseExistingServer: false,
    stdout: process.env.E2E_DEBUG ? 'pipe' : 'ignore',
    stderr: process.env.E2E_DEBUG ? 'pipe' : 'ignore',
  },
});
