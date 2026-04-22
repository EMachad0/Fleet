import { test, expect } from '../../../support/fixtures';

/**
 * What this spec protects:
 *
 *   1. The "Back to sign in" button routes a guest back to `/auth/login`.
 *   2. The server guard in `+page.server.ts` keeps the page inaccessible to
 *      already-authed callers — a signed-in user seeing "Request access"
 *      would be nonsensical and leaks a dead-end screen.
 *
 * Register is currently a placeholder (no self-signup form yet). When
 * self-signup lands, its form submission tests — success, validation
 * errors, duplicate email — belong here.
 */

test('guest can return to login from the Request access card', async ({ guestPage }) => {
  await guestPage.goto('/auth/register');
  await guestPage.getByRole('link', { name: 'Back to sign in' }).click();
  await expect(guestPage).toHaveURL(/\/auth\/login/);
});

test('signed-in visitor never sees the Request access card', async ({ page }) => {
  // The guard bounces to `/`, which the entry resolver then sends to
  // `/auth/select-tenant` for this fresh fixture user (zero memberships →
  // no default landing). We assert the final URL rather than the `/` hop
  // because the hop is an entry-resolver implementation detail, not a
  // contract of the register route.
  await page.goto('/auth/register');
  await expect(page).toHaveURL(/\/auth\/select-tenant/);
});
