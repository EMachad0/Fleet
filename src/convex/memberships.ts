import { ConvexError } from 'convex/values';
import { z } from 'zod';
import { zid } from 'convex-helpers/server/zod4';
import { authComponent } from './auth';
import { zMutation, zQuery } from './functions';

type MembershipWithArchiveState = { archivedAt?: number };
type MembershipWithSelectionState = MembershipWithArchiveState & { selectedAt: number };
type MembershipWithAccessState = MembershipWithArchiveState & { userId: string };

export function isMembershipActive<M extends MembershipWithArchiveState>(membership: M): boolean {
  return membership.archivedAt === undefined;
}

export function listActiveMembershipsByRecency<M extends MembershipWithSelectionState>(
  memberships: readonly M[],
): M[] {
  return memberships.filter(isMembershipActive).sort((a, b) => b.selectedAt - a.selectedAt);
}

export function assertMembershipCanBeSelected<M extends MembershipWithAccessState>(
  membership: M | null,
  userId: string,
): asserts membership is M {
  if (!membership || membership.userId !== userId) {
    throw new ConvexError('Not a member of that tenant');
  }
  if (!isMembershipActive(membership)) {
    throw new ConvexError('That workspace is archived');
  }
}

/**
 * Resolves the tenant the URL is pointing at + the caller's membership in
 * it. Returns `null` if the tenant doesn't exist, the caller isn't a
 * member, or the membership is archived. The tenant-type check (URL
 * segment vs `tenant.type`) is the caller's job — it already has the URL,
 * and doing the comparison here would just duplicate a trivial equality
 * check.
 *
 * The authenticated user is read from the Convex auth context; it's never
 * accepted as a client argument.
 */
export const getCurrentMembership = zQuery({
  args: {
    tenantSlug: z.string(),
  },
  handler: async (ctx, { tenantSlug }) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) return null;

    const tenant = await ctx.db
      .query('tenants')
      .withIndex('by_slug', (q) => q.eq('slug', tenantSlug))
      .unique();
    if (!tenant) return null;

    const membership = await ctx.db
      .query('memberships')
      .withIndex('by_tenant_user', (q) => q.eq('tenantId', tenant._id).eq('userId', user._id))
      .unique();
    if (!membership || !isMembershipActive(membership)) return null;

    return {
      user: { _id: user._id, name: user.name, email: user.email },
      tenant: {
        _id: tenant._id,
        name: tenant.name,
        slug: tenant.slug,
        type: tenant.type,
      },
      role: membership.role,
    };
  },
});

/**
 * Every *active* membership the caller belongs to, with the tenant
 * hydrated for display. Archived memberships are filtered out server-side
 * so UI code doesn't re-learn the archive contract; the subscription
 * re-runs on archive/unarchive, so the tenant-picker updates live.
 *
 * Sorted by `selectedAt` descending — the most-recently active workspace
 * shows up first on the picker. Grouping by tenant type stays the
 * caller's concern (pure helper, colocated with the route).
 */
export const countMyMemberships = zQuery({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) return 0;

    const memberships = await ctx.db
      .query('memberships')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect();

    return memberships.filter(isMembershipActive).length;
  },
});

export const listMyMemberships = zQuery({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) return [];

    const memberships = await ctx.db
      .query('memberships')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect();

    const active = listActiveMembershipsByRecency(memberships);

    const hydrated = await Promise.all(
      active.map(async (m) => {
        const tenant = await ctx.db.get(m.tenantId);
        if (!tenant) return null;
        return {
          _id: m._id,
          role: m.role,
          selectedAt: m.selectedAt,
          tenant: {
            _id: tenant._id,
            name: tenant.name,
            slug: tenant.slug,
            type: tenant.type,
          },
        };
      }),
    );

    return hydrated.filter((m): m is NonNullable<typeof m> => m !== null);
  },
});

/**
 * Stamps `selectedAt = now` on the caller's membership. The URL chosen
 * next is the only place an "active membership" decision is actually
 * recorded, and the stamp is what makes that row sort first on the
 * tenant-picker next time around.
 *
 * Returns the updated membership with its tenant hydrated so the caller
 * can navigate straight to `/app/[type]/[slug]` without a follow-up query.
 *
 * Throws if the membership doesn't exist, doesn't belong to the caller
 * (prevents stamping someone else's row), or is archived (an archived
 * membership isn't a valid destination — restore it first).
 */
export const selectMembership = zMutation({
  args: { membershipId: zid('memberships') },
  handler: async (ctx, { membershipId }) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError('Not authenticated');

    const membership = await ctx.db.get(membershipId);
    assertMembershipCanBeSelected(membership, user._id);

    const now = Date.now();
    await ctx.db.patch(membership._id, { selectedAt: now });

    const tenant = await ctx.db.get(membership.tenantId);
    if (!tenant) throw new ConvexError('Tenant vanished mid-flight');

    return {
      _id: membership._id,
      role: membership.role,
      selectedAt: now,
      tenant: {
        _id: tenant._id,
        name: tenant.name,
        slug: tenant.slug,
        type: tenant.type,
      },
    };
  },
});
