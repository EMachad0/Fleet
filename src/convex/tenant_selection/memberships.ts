import { ConvexError } from 'convex/values';
import { zid } from 'convex-helpers/server/zod4';
import { authComponent } from '$convex/auth';
import { azQuery, zMutation, zQuery } from '$convex/functions';
import {
  isMembershipActive,
  listActiveMembershipsByRecency,
} from '$convex/_services/membership_lifecycle/memberships';

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
            type: tenant.type,
          },
        };
      }),
    );

    return hydrated.filter((m): m is NonNullable<typeof m> => m !== null);
  },
});

export const selectMembership = zMutation({
  args: { membershipId: zid('memberships') },
  handler: async (ctx, { membershipId }) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError('Not authenticated');

    const membership = await ctx.db.get(membershipId);
    if (!membership || membership.userId !== user._id) {
      throw new ConvexError('Not a member of that tenant');
    }
    if (!isMembershipActive(membership)) {
      throw new ConvexError('That workspace is archived');
    }

    const now = Date.now();
    await ctx.db.patch(membershipId, { selectedAt: now });

    const tenant = await ctx.db.get(membership.tenantId);
    if (!tenant) throw new ConvexError('Tenant vanished mid-flight');

    return {
      _id: membership._id,
      role: membership.role,
      selectedAt: now,
      tenant: {
        _id: tenant._id,
        name: tenant.name,
        type: tenant.type,
      },
    };
  },
});
