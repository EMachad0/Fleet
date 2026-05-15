import { randomBytes } from 'node:crypto';
import { test, expect } from '../../../support/fixtures';

/**
 * What this spec protects:
 *
 *   1. Happy path — valid credentials land the user wherever the entry
 *      resolver routes them.
 *   2. Wrong password surfaces Better Auth's exact "Invalid email or
 *      password" copy. `mapAuthError` in `+page.svelte` is the choke
 *      point: it must pass 4xx messages through and only swap 5xx /
 *      "fetch related error" shapes for the generic fallback. If this
 *      ever collapses to "We couldn't sign you in right now", that's
 *      the same proxy-error regression we chased before.
 *   3. Unknown email surfaces the same copy — if it ever differs, we
 *      have a user-enumeration leak at the auth layer.
 *   4. Client-side Zod validators block the sign-in HTTP call outright
 *      when required fields are missing (no wasted round trip, no
 *      flashed server error).
 *   5. SPA mode holds: submit never POSTs to the route's implicit form
 *      action. Only the `/api/auth/sign-in/email` call fires.
 *   6. The server guard in `+page.server.ts` bounces already-signed-in
 *      callers away from the form.
 *
 * All guest-path tests use `guestPage` (see fixtures.ts); the default
 * `page` is pre-authed and would already be past this screen.
 */

// Every form-facing test below goes through `{ waitUntil: 'networkidle' }`.
// This form is SPA mode (`SPA: true` in `createForm` + `onsubmit=(e) =>
// e.preventDefault()`), so there is no server-action fallback — the submit
// handler is *only* wired in client JS and needs hydration to do anything.
// Under Vite dev, client chunks arrive after `load`, so an eager click
// either no-ops or blind-POSTs to a 405. Hence networkidle. See the
// testing skill rule 7 for the longer story.

test('happy path: valid credentials advance past the login form', async ({ guestPage, user }) => {
  await guestPage.goto('/auth/login', { waitUntil: 'networkidle' });
  await guestPage.getByLabel('Email').fill(user.email);
  await guestPage.getByLabel('Password').fill(user.password);
  await guestPage.getByRole('button', { name: 'Sign in' }).click();

  // Fresh fixture user has zero memberships → entry resolver sends them
  // to select-tenant. Asserting the final URL (not the `/` hop) keeps
  // the spec insulated from entry-resolver internals.
  await expect(guestPage).toHaveURL(/\/auth\/select-tenant/);
});

test("wrong password surfaces Better Auth's exact message", async ({ guestPage, user }) => {
  await guestPage.goto('/auth/login', { waitUntil: 'networkidle' });
  await guestPage.getByLabel('Email').fill(user.email);
  await guestPage.getByLabel('Password').fill('definitely-not-the-password');
  await guestPage.getByRole('button', { name: 'Sign in' }).click();

  await expect(guestPage.getByText('Invalid email or password')).toBeVisible();
  await expect(guestPage).toHaveURL(/\/auth\/login/);
});

test('unknown email surfaces the same message (no enumeration leak)', async ({ guestPage }) => {
  // Intentionally skip the `user` fixture — this address must not exist.
  // Better Auth returns `INVALID_EMAIL_OR_PASSWORD` for both wrong-password
  // and unknown-email by design; if the copy ever differs here, an
  // attacker can probe which emails have accounts.
  await guestPage.goto('/auth/login', { waitUntil: 'networkidle' });
  await guestPage.getByLabel('Email').fill(`missing-${randomBytes(6).toString('hex')}@test.local`);
  await guestPage.getByLabel('Password').fill('anything');
  await guestPage.getByRole('button', { name: 'Sign in' }).click();

  await expect(guestPage.getByText('Invalid email or password')).toBeVisible();
  await expect(guestPage).toHaveURL(/\/auth\/login/);
});

test('empty fields block the sign-in HTTP call entirely', async ({ guestPage }) => {
  // Subscribe before navigation so we capture everything from first paint.
  const signInCalls: string[] = [];
  guestPage.on('request', (req) => {
    if (req.url().includes('/api/auth/sign-in/email')) signInCalls.push(req.url());
  });

  await guestPage.goto('/auth/login', { waitUntil: 'networkidle' });
  await guestPage.getByRole('button', { name: 'Sign in' }).click();

  // Waiting for the visible field errors is the synchronization point:
  // Zod's client validators run before any fetch, so once the errors
  // appear we know a would-be sign-in call has had its chance to fire.
  // The strings come straight from `loginSchema` in `src/convex/schemas/auth.ts`.
  await expect(guestPage.getByText('Enter a valid email')).toBeVisible();
  await expect(guestPage.getByText('Password is required')).toBeVisible();
  expect(signInCalls).toEqual([]);
  await expect(guestPage).toHaveURL(/\/auth\/login/);
});

test('submit does not POST to the route (SPA mode holds)', async ({ guestPage, user }) => {
  // Three layers prevent this POST: `SPA: true` in `createForm`,
  // `use:enhance`, and the belt-and-suspenders `onsubmit={(e) =>
  // e.preventDefault()}` in the template. The test locks in the
  // combined outcome so a regression in any single layer surfaces
  // here, not as a 405 in prod logs.
  const routePosts: string[] = [];
  guestPage.on('request', (req) => {
    if (req.method() === 'POST' && new URL(req.url()).pathname === '/auth/login') {
      routePosts.push(req.url());
    }
  });

  await guestPage.goto('/auth/login', { waitUntil: 'networkidle' });
  await guestPage.getByLabel('Email').fill(user.email);
  await guestPage.getByLabel('Password').fill(user.password);
  await guestPage.getByRole('button', { name: 'Sign in' }).click();

  // Wait for the flow to complete so any errant POST has had time to fire.
  await expect(guestPage).toHaveURL(/\/auth\/select-tenant/);
  expect(routePosts).toEqual([]);
});

test('already-signed-in visitor never sees the login form', async ({ page }) => {
  // Guard in `+page.server.ts`: `if (locals.session) redirect(303, '/')`.
  // The entry resolver at `/` then sends this fresh fixture user (no
  // memberships) on to `/auth/select-tenant`.
  await page.goto('/auth/login');
  await expect(page).toHaveURL(/\/auth\/select-tenant/);
});
