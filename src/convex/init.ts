import { ConvexError, v } from 'convex/values';
import { internalAction, internalMutation } from './_generated/server';
import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import { authComponent, createAuth } from './auth';

type TenantType = Doc<'tenants'>['type'];
type MembershipRole = Doc<'memberships'>['role'];

type SeedUser = { email: string; name: string; password: string };
type SeedTenant = { slug: string; name: string; type: TenantType };
type SeedMembership = { email: string; tenantSlug: string; role: MembershipRole };

/**
 * Local dev fixtures. This file IS the "what exists in my dev DB"
 * documentation — keep it declarative and grow by adding entries.
 *
 * The declaration order (users → tenants → memberships) mirrors the
 * dependency order: a membership needs both a user and a tenant to exist
 * before it can point at them, and we don't have real ids yet when we're
 * authoring this, so memberships are keyed by `email` and `tenantSlug`.
 * Those resolve to real ids at apply time.
 *
 * To wipe the deployment run `bun run clear`. To wipe and reseed,
 * compose: `bun run clear && bun run seed`. The wipe lives in
 * `scripts/clear.ts` — see that file for why it can't be a Convex
 * function.
 */
export const SEED_USERS: ReadonlyArray<SeedUser> = [
  // Real users
  { email: 'elitonmachadod200@gmail.com', name: 'Eliton Machado', password: 'password' },

  // Fake users — for testing multi-tenant, multi-role, and edge cases
  { email: 'alice@example.com', name: 'Alice Johnson', password: 'password' },
  { email: 'bob@example.com', name: 'Bob Smith', password: 'password' },
  { email: 'john@example.com', name: 'John Doe', password: 'password' },
  { email: 'jane@example.com', name: 'Jane Doe', password: 'password' },
  { email: 'charlie@example.com', name: 'Charlie Brown', password: 'password' },
  { email: 'diana@example.com', name: 'Diana Prince', password: 'password' },
];

const SEED_TENANTS: ReadonlyArray<SeedTenant> = [
  { slug: 'acme-test', name: 'Acme Test', type: 'consumer' },
  { slug: 'fixit-test', name: 'FixIt Test', type: 'contractor' },
  { slug: 'fleet-ops', name: 'Fleet Ops', type: 'admin' },
];

export const SEED_MEMBERSHIPS: ReadonlyArray<SeedMembership> = [
  // Real users — full access
  { email: 'elitonmachadod200@gmail.com', tenantSlug: 'acme-test', role: 'owner' },
  { email: 'elitonmachadod200@gmail.com', tenantSlug: 'fixit-test', role: 'owner' },
  { email: 'elitonmachadod200@gmail.com', tenantSlug: 'fleet-ops', role: 'owner' },

  // Fake users — varied membership scenarios
  { email: 'alice@example.com', tenantSlug: 'acme-test', role: 'admin' },
  { email: 'alice@example.com', tenantSlug: 'fixit-test', role: 'member' },
  { email: 'bob@example.com', tenantSlug: 'acme-test', role: 'member' },
  { email: 'john@example.com', tenantSlug: 'fixit-test', role: 'admin' },
  { email: 'jane@example.com', tenantSlug: 'acme-test', role: 'member' },
  { email: 'jane@example.com', tenantSlug: 'fixit-test', role: 'member' },
  // charlie and diana have no memberships — orphaned users for testing
];

/**
 * Default-exported internal action so `bunx convex run init` picks it
 * up — the Convex team treats `convex/init.ts` with a default export as
 * the conventional seed hook
 * (https://stack.convex.dev/seeding-data-for-preview-deployments).
 *
 * Shape:
 *   1. Sign each user up via Better Auth (`auth.api.signUpEmail`) so the
 *      hashed credential + account row + session bookkeeping are set up
 *      correctly — inserting into the auth tables by hand would silently
 *      produce unusable accounts. Each call is its own Convex
 *      transaction via the adapter's `ctx.runMutation`, which is why we
 *      need an action here and not a mutation.
 *   2. Hand the resolved `email -> userId` map to `applyFixtures`, which
 *      writes the rest of the graph in a single atomic transaction.
 *
 * No idempotency guard: the script assumes an empty database. If
 * tenants / users already exist, the sign-up or insert throws loudly —
 * which is the right behavior. We trust the caller.
 */
export default internalAction({
  args: {},
  handler: async (ctx): Promise<{ seeded: boolean }> => {
    const { auth } = await authComponent.getAuth(createAuth, ctx);

    const userIdByEmail: Record<string, string> = {};
    for (const u of SEED_USERS) {
      const res = await auth.api.signUpEmail({
        body: { email: u.email, password: u.password, name: u.name },
      });
      userIdByEmail[u.email] = res.user.id;
    }

    await ctx.runMutation(internal.init.applyFixtures, { userIdByEmail });

    console.log('[init] seeded');
    return { seeded: true };
  },
});

/**
 * Writes every non-auth fixture in one atomic transaction so cross-row
 * invariants never land half-applied. Grows alongside `src/convex/schema.ts`:
 * each new table with a meaningful dev fixture gets its own section here,
 * keyed off the shared `SEED_*` constants above.
 *
 * Explicit handler return type is load-bearing: this mutation is
 * referenced via `internal.init.applyFixtures` from the default action in
 * the same file, which routes through the generated `api` aggregate.
 * Without the annotation TypeScript can't resolve the inferred return and
 * the inference goes circular — one `any` in `src/convex/*` leaks across
 * the whole generated client and poisons `api`/`internal` usage
 * everywhere else. Cutting the cycle here keeps downstream `.query(...)`
 * / `.mutation(...)` callsites correctly typed.
 */
export const applyFixtures = internalMutation({
  args: { userIdByEmail: v.record(v.string(), v.string()) },
  handler: async (ctx, { userIdByEmail }): Promise<void> => {
    const tenantIdBySlug: Record<string, Id<'tenants'>> = {};
    for (const t of SEED_TENANTS) {
      tenantIdBySlug[t.slug] = await ctx.db.insert('tenants', {
        slug: t.slug,
        name: t.name,
        type: t.type,
      });
    }

    // All memberships in a single seed run get the same stamp; the
    // schema just wants a non-null number and the tenant-picker's sort
    // order doesn't matter for seed data that'll be rewritten the first
    // time the user actually picks a tenant.
    const now = Date.now();
    for (const m of SEED_MEMBERSHIPS) {
      const userId = userIdByEmail[m.email];
      const tenantId = tenantIdBySlug[m.tenantSlug];
      if (!userId) throw new ConvexError(`seed: no user ${m.email}`);
      if (!tenantId) throw new ConvexError(`seed: no tenant ${m.tenantSlug}`);

      await ctx.db.insert('memberships', {
        userId,
        tenantId,
        role: m.role,
        selectedAt: now,
      });
    }
  },
});
