import { requireEnv } from './env';

/**
 * Admin-channel fixture creation: sign users up via Better Auth's HTTP
 * endpoint directly. Same path the UI hits — we're just skipping the form.
 * No cleanup is needed because each test's email is unique (see the `user`
 * fixture in `./fixtures.ts`).
 *
 * Why Convex's HTTP URL and not the SvelteKit proxy at
 * `PUBLIC_SITE_URL/api/auth/sign-up/email`? Fixture setup shouldn't depend
 * on the dev server being healthy. If the proxy is the thing under test
 * (e.g. the `fetch failed` regression we chased in `+server.ts`), sign-up
 * still works because it bypasses the proxy entirely.
 *
 * Why the explicit `Origin` header? Better Auth rejects requests that don't
 * match its `trustedOrigins` with `MISSING_OR_NULL_ORIGIN` / 403. The
 * SvelteKit proxy normally forwards the browser's `Origin`; raw `fetch()`
 * from Node sends no `Origin` at all, so we set one that matches
 * `PUBLIC_SITE_URL` (the baseURL Better Auth's config trusts).
 *
 * Why not `bunx convex run init`? That script seeds *shared* dev fixtures
 * (see `src/convex/init.ts`). E2E tests need *per-test* data, which is a
 * different job.
 */
const CONVEX_SITE_URL = requireEnv('PUBLIC_CONVEX_SITE_URL');
const SITE_ORIGIN = requireEnv('PUBLIC_SITE_URL');

export type TestUser = { email: string; password: string; name: string };

export async function createUser(user: TestUser): Promise<TestUser> {
  const res = await fetch(`${CONVEX_SITE_URL}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: SITE_ORIGIN,
    },
    body: JSON.stringify(user),
  });
  if (!res.ok) {
    throw new Error(`createUser failed (${res.status}): ${await res.text()}`);
  }
  return user;
}
