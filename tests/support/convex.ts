import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../src/convex/_generated/api';
import type { Doc, Id } from '../../src/convex/_generated/dataModel';
import { requireEnv } from './env';

/**
 * Admin-channel fixture creation: sign users up via Better Auth's HTTP
 * endpoint directly. Same path the UI hits — we're just skipping the form.
 * `bun run test:e2e` provisions a disposable self-hosted Convex backend per
 * run via Testcontainers, so fixture data disappears with that backend at the
 * end of the run instead of being cleaned table-by-table.
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

export type TestUser = { email: string; password: string; name: string; userId?: string };

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
  const body = await res.json();
  return { ...user, userId: body.user?.id };
}

type TenantType = Doc<'tenants'>['type'];
type MembershipRole = Doc<'memberships'>['role'];

export type TestTenant = { name: string; slug: string; type: TenantType; _id?: Id<'tenants'> };

let _convexClient: ConvexHttpClient | undefined;
const convexClient = () =>
  (_convexClient ??= new ConvexHttpClient(requireEnv('PUBLIC_CONVEX_URL')));

export async function createTenant(tenant: {
  name: string;
  slug: string;
  type: TenantType;
}): Promise<TestTenant> {
  const client = convexClient();
  const id = await client.mutation(api.tenant_test_helper.createTenant, tenant);
  return { ...tenant, _id: id };
}

export async function createMembership(opts: {
  userId: string;
  tenantId: Id<'tenants'>;
  role: MembershipRole;
}): Promise<Id<'memberships'>> {
  const client = convexClient();
  return await client.mutation(api.membership_test_helper.createMembership, opts);
}
