import { test as base, expect, type Page } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import {
  createMembership,
  createTenant,
  createUser,
  type TestTenant,
  type TestUser,
} from './convex';
import type { Id } from '../../src/convex/_generated/dataModel';
import { requireEnv } from './env';

type Fixtures = {
  user: TestUser;
  tenant: TestTenant;
  membership: { _id: Id<'memberships'> };
  page: Page;
  guestPage: Page;
};

/**
 * E2E fixtures. See `.agents/skills/testing/SKILL.md` (rules 4 and 6) for
 * the reasoning.
 *
 * `user` — every test that names this fixture gets its own Better Auth
 * account. Two tests running in parallel each own a disjoint
 * `user-<random>@test.local`, so they cannot race.
 *
 * `page` — we override Playwright's built-in `page` fixture with one whose
 * `BrowserContext` is already signed in, because virtually every spec in
 * this app runs against authenticated surfaces. The trick: `ctx.request`
 * shares its cookie jar with any page opened from the same context, so a
 * POST to `/api/auth/sign-in/email` from `ctx.request` logs the context in
 * without any UI form, any `storageState` file, or any hard-coded cookie
 * name. See https://playwright.dev/docs/auth#authenticate-with-api-request.
 *
 * `guestPage` — a fresh, cookie-less `Page`. Use it for anything that
 * exercises the logged-out path: the login/register flows, the entry
 * resolver's unauthenticated branch, server guards redirecting anonymous
 * callers to `/auth/login?next=…`, public marketing routes, etc. It is
 * deliberately a separate name rather than a second `page` override so
 * each spec is explicit about which auth state it's testing — "this file
 * signs in, that file doesn't" is the first thing a reader needs to know.
 */
export const test = base.extend<Fixtures>({
  // eslint-disable-next-line no-empty-pattern
  user: async ({}, use) => {
    const id = randomBytes(8).toString('hex');
    const user = await createUser({
      email: `user-${id}@test.local`,
      password: `pw-${id}`,
      name: `User ${id}`,
    });
    await use(user);
  },

  // eslint-disable-next-line no-empty-pattern
  tenant: async ({}, use) => {
    const id = randomBytes(6).toString('hex');
    const tenant = await createTenant({
      name: `Tenant ${id}`,
      slug: `tenant-${id}`,
      type: 'consumer',
    });
    await use(tenant);
  },

  membership: async ({ user, tenant }, use) => {
    if (!user.userId) throw new Error('user fixture must provide userId');
    if (!tenant._id) throw new Error('tenant fixture must provide _id');
    const membershipId = await createMembership({
      userId: user.userId,
      tenantId: tenant._id,
      role: 'member',
    });
    await use({ _id: membershipId });
  },

  page: async ({ browser, user }, use) => {
    const ctx = await browser.newContext();
    // `ctx.request` is a programmatic HTTP client, not a browser — it does
    // not add an `Origin` header automatically, and Better Auth's
    // `trustedOrigins` check rejects the request without one. Read the
    // origin from env (same source the proxy/app uses) rather than hard-
    // coding a default here.
    const res = await ctx.request.post('/api/auth/sign-in/email', {
      data: { email: user.email, password: user.password },
      headers: { origin: requireEnv('PUBLIC_SITE_URL') },
    });
    if (!res.ok()) {
      throw new Error(`fixture sign-in failed (${res.status()}): ${await res.text()}`);
    }
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },

  guestPage: async ({ browser }, use) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },
});

export { expect };
