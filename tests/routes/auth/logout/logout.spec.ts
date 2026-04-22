import { test, expect } from '../../../support/fixtures';

/**
 * What this spec protects:
 *
 *   1. The two buttons on `/auth/logout` route to the right destination for
 *      a signed-in caller.
 *   2. The server guard in `+page.server.ts` keeps the page inaccessible to
 *      logged-out callers — there is no "sign out of what?" screen.
 *
 * The downstream "did the session really end?" invariant (server-guarded
 * routes redirecting unauthenticated callers) lives next to the route that
 * enforces it, not here.
 */

test('clicking Sign out ends the session', async ({ page }) => {
  // `networkidle` matters here: the Sign out button is wired via Svelte's
  // `onclick`, which only works after hydration. Vite dev serves each
  // client chunk as a separate HTTP request, and under parallel-worker
  // load those requests can lag past the default "load" event. Clicking
  // too early drops the handler silently (no network request, no console
  // error), which manifests as a URL-stayed-on-/auth/logout flake.
  await page.goto('/auth/logout', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Sign out' }).click();

  // `authClient.signOut()` in the page handler navigates to /auth/login on
  // success; anything else means the sign-out call itself failed.
  await expect(page).toHaveURL(/\/auth\/login/);
});

test('clicking Cancel keeps the session', async ({ page }) => {
  await page.goto('/auth/logout');
  await page.getByRole('link', { name: 'Cancel' }).click();
});

test('logged-out visitor never sees the logout confirmation', async ({ guestPage }) => {
  // The guard lives in `+page.server.ts` and bounces to `/`, which the entry
  // resolver then sends to `/auth/login`. We assert the final URL rather than
  // the intermediate `/` because Playwright follows 303s transparently and
  // the intermediate redirect is an implementation detail of the entry
  // resolver, not a contract of the logout route.
  await guestPage.goto('/auth/logout');
  await expect(guestPage).toHaveURL(/\/auth\/login/);
});
