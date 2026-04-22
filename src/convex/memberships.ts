import { z } from 'zod';
import { authComponent } from './auth';
import { zQuery } from './functions';

/**
 * The single query `/app/+layout.server.ts` calls to resolve the tenant
 * the URL is pointing at. Looks up the tenant by slug and returns the
 * caller's membership + hydrated tenant/user info, or `null` if either
 * the tenant doesn't exist or the caller isn't a member.
 *
 * The tenant-type check (URL segment vs `tenant.type`) is the caller's
 * job — it already has the URL, and doing the comparison server-side
 * here would just duplicate a trivial equality check.
 *
 * The authenticated user is read from the Convex auth context; it's
 * never accepted as a client argument.
 */
export const getMembership = zQuery({
  args: {
    slug: z.string(),
  },
  handler: async (ctx, { slug }) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) return null;

    const tenant = await ctx.db
      .query('tenants')
      .withIndex('by_slug', (q) => q.eq('slug', slug))
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
