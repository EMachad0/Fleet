import { ConvexError } from 'convex/values';
import { zid } from 'convex-helpers/server/zod4';
import { authComponent } from './auth';
import { azQuery, zMutation, zQuery } from './functions';

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

export const getCurrentMembership = azQuery({
  args: {},
  handler: async (ctx) => {
    const membership = await ctx.db
      .query('memberships')
      .withIndex('by_tenant_user', (q) =>
        q.eq('tenantId', ctx.tenant._id).eq('userId', ctx.user._id),
      )
      .unique();
    if (!membership || !isMembershipActive(membership)) return null;

    return {
      user: ctx.user,
      tenant: ctx.tenant,
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
