/**
 * Fail-fast env reader for tests.
 *
 * Tests never ship with URL defaults — a missing env var is a configuration
 * error, not a "fall back to localhost" situation. Silent defaults are how
 * you end up running tests against the wrong origin for 20 minutes before
 * noticing, or how a CI misconfiguration masquerades as a passing suite.
 *
 * Why we don't load `.env.local` here ourselves: `bun run test:e2e` now
 * boots an isolated self-hosted Convex backend per run and injects the
 * resulting URLs into Playwright before it starts. The package.json script
 * still uses `bun --env-file=.env.local` to seed the runner process with
 * whatever non-test-specific env your local setup needs. Bun documents this
 * flag as the workaround for a known bug where package.json scripts invoked
 * with `bun run` / `bunx` do NOT auto-load `.env*` files the way the bun
 * runtime does. See:
 *   - https://bun.sh/docs/runtime/env (`--env-file` section)
 *   - https://github.com/oven-sh/bun/issues/23962 (open tracking issue)
 *
 * Keeping the loader out of this file means: one source of truth for env
 * loading (the script), one source of truth for required values (here).
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required env var ${name}. Set it in .env.local (see .env.example) ` +
        `or export it in your shell before running tests. If you invoked Playwright ` +
        `directly, use \`bun run test:e2e\` so the isolated backend and test URLs are ` +
        `provisioned for you.`,
    );
  }
  return value;
}
