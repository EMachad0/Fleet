import { ConvexError } from 'convex/values';
import { z } from 'zod';
import { zid } from 'convex-helpers/server/zod4';
import { authComponent } from './auth';
import { zMutation, zQuery } from './functions';

/**
 * Resolves the tenant the URL is pointing at + the caller's membership in
 * it. Returns `null` if either the tenant doesn't exist or the caller isn't
 * a member. The tenant-type check (URL segment vs `tenant.type`) is the
 * caller's job — it already has the URL, and doing the comparison here
 * would just duplicate a trivial equality check.
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
    if (!membership) return null;

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
 * Every membership the caller belongs to, with the tenant hydrated for
 * display and navigation. Grouping/ordering is the caller's concern.
 */
export const listMyMemberships = zQuery({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) return [];

    const memberships = await ctx.db
      .query('memberships')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect();

    const hydrated = await Promise.all(
      memberships.map(async (m) => {
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
 * recorded, and the stamp is what makes that the default next login.
 *
 * Returns the updated membership with its tenant hydrated so the caller
 * can navigate straight to `/app/[type]/[slug]` without a follow-up query.
 *
 * Throws if the membership doesn't exist or doesn't belong to the caller
 * (prevents a user from stamping someone else's membership).
 */
export const selectMembership = zMutation({
  args: { membershipId: zid('memberships') },
  handler: async (ctx, { membershipId }) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError('Not authenticated');

    const membership = await ctx.db.get(membershipId);
    if (!membership || membership.userId !== user._id) {
      throw new ConvexError('Not a member of that tenant');
    }

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
