import { ConvexError } from 'convex/values';
import { zid } from 'convex-helpers/server/zod4';
import { authComponent } from './auth';
import { zMutation, zQuery } from './functions';

export const listMine = zQuery({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) return [];

    const memberships = await ctx.db
      .query('memberships')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect();

    const tenants = await Promise.all(
      memberships.map(async (membership) => {
        const tenant = await ctx.db.get(membership.tenantId);
        if (!tenant) return null;
        return {
          _id: tenant._id,
          name: tenant.name,
          slug: tenant.slug,
          type: tenant.type,
          role: membership.role,
        };
      }),
    );

    return tenants.filter((t): t is NonNullable<typeof t> => t !== null);
  },
});

/**
 * Stamps `selectedAt = now` on the caller's matching membership. Called
 * from `/auth/select-tenant`'s action — the URL chosen next is the only
 * place an "active membership" decision is actually recorded, and the
 * stamp is what makes that the default next login.
 *
 * Throws if the caller isn't a member of `tenantId`.
 */
export const selectTenant = zMutation({
  args: { tenantId: zid('tenants') },
  handler: async (ctx, { tenantId }) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError('Not authenticated');

    const membership = await ctx.db
      .query('memberships')
      .withIndex('by_tenant_user', (q) => q.eq('tenantId', tenantId).eq('userId', user._id))
      .unique();
    if (!membership) throw new ConvexError('Not a member of that tenant');

    await ctx.db.patch(membership._id, { selectedAt: Date.now() });

    const tenant = await ctx.db.get(tenantId);
    if (!tenant) throw new ConvexError('Tenant vanished mid-flight');

    return {
      type: tenant.type,
      slug: tenant.slug,
    };
  },
});
