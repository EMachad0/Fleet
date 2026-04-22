import { test, expect } from '../../../support/fixtures';

/**
 * What this spec protects:
 *
 *   1. The server guard in `+page.server.ts` keeps guests out — no
 *      point rendering a "choose a workspace" card for someone who
 *      hasn't signed in. They go through `/` → `/auth/login`.
 *   2. A freshly-signed-up user with zero memberships sees the
 *      "contact your administrator" copy instead of an empty form,
 *      and the identity line below the title reflects the account
 *      they're signed in as.
 *   3. The footer's "Sign out instead" link routes to `/auth/logout`.
 *      It's the only way off this page for users who don't belong to
 *      any workspace yet.
 *
 * What this spec deliberately does NOT cover:
 *
 *   - Rendering and selecting among multiple memberships. That flow
 *     needs a user with ≥1 membership, which in turn needs a tenant +
 *     membership seeding helper we don't have yet (Better Auth handles
 *     signup via its HTTP endpoint, but tenants are only created via
 *     `src/convex/init.ts`, an internal action). The grouping logic
 *     itself — canonical order, empty-bucket dropping — is already
 *     covered in `./memberships.test.ts` (colocated next to
 *     `src/routes/auth/select-tenant/memberships.ts`), so we're not
 *     blind on the rendering contract; we're only missing an end-to-end
 *     flow that drives the radio-list and redirects into `/app/[type]/[slug]`.
 *     Add that spec alongside a `seedMembership` helper when we need
 *     it.
 */

test('guest is bounced away from select-tenant', async ({ guestPage }) => {
  // Guard redirects to `/`, which the entry resolver forwards to
  // `/auth/login` for an anonymous caller.
  await guestPage.goto('/auth/select-tenant');
  await expect(guestPage).toHaveURL(/\/auth\/login/);
});

test('user with zero memberships sees the contact-your-admin copy', async ({ page, user }) => {
  // The default fixture user was just created via Better Auth and has
  // no memberships, which is exactly what this test wants — it's the
  // "entered the app but nobody's added me anywhere yet" state.
  await page.goto('/auth/select-tenant');

  // `Card.Title` in the shadcn-svelte kit renders as a `<div>`, not a
  // semantic heading, so `getByRole('heading', …)` would miss it; that's
  // an a11y gap in the kit (worth fixing upstream later) rather than
  // something to work around with a testid.
  await expect(page.getByText('Choose a workspace')).toBeVisible();
  await expect(page.getByText(/isn't part of any workspace yet/)).toBeVisible();
  // Identity context from the SSR load — confirms `data.user` wiring
  // survived the refactor alongside `data.memberships`.
  await expect(page.getByText(user.email)).toBeVisible();
  await expect(page.getByText(user.name)).toBeVisible();
  // No form = no submit button. Avoids regressions where the empty
  // branch silently starts rendering a disabled Continue button.
  await expect(page.getByRole('button', { name: /Continue|Entering/ })).toBeHidden();
});

test('the "Sign out instead" link routes to /auth/logout', async ({ page }) => {
  await page.goto('/auth/select-tenant');
  await page.getByRole('link', { name: 'Sign out instead' }).click();
  await expect(page).toHaveURL(/\/auth\/logout/);
});
