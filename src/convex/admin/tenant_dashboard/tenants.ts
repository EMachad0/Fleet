import { z } from 'zod';
import { zid } from 'convex-helpers/server/zod4';
import { adminMutation, adminQuery } from '$convex/functions';
import { tenantTypeSchema } from '$convex/schemas/tenant';
import { authComponent } from '$convex/auth';
import { isMembershipActive } from '$convex/_services/membership_lifecycle/memberships';
import { createTenant as createTenantService } from '$convex/_services/tenant_provisioning/tenants';

export const listTenants = adminQuery({
  args: {},
  handler: async (ctx) => {
    const tenants = await ctx.db.query('tenants').collect();

    return Promise.all(
      tenants.map(async (tenant) => {
        const memberships = await ctx.db
          .query('memberships')
          .withIndex('by_tenant_user', (q) => q.eq('tenantId', tenant._id))
          .collect();

        return {
          _id: tenant._id,
          name: tenant.name,
          uuid: tenant.uuid,
          type: tenant.type,
          memberCount: memberships.filter(isMembershipActive).length,
          totalMemberCount: memberships.length,
          _creationTime: tenant._creationTime,
        };
      }),
    );
  },
});

export const getTenantWithMemberships = adminQuery({
  args: { targetTenantId: zid('tenants') },
  handler: async (ctx, { targetTenantId }) => {
    const tenant = await ctx.db.get(targetTenantId);
    if (!tenant) return null;

    const memberships = await ctx.db
      .query('memberships')
      .withIndex('by_tenant_user', (q) => q.eq('tenantId', tenant._id))
      .collect();

    const hydrated = await Promise.all(
      memberships.map(async (m) => {
        const user = await authComponent.getAnyUserById(ctx, m.userId);
        return {
          _id: m._id,
          userId: m.userId,
          role: m.role,
          selectedAt: m.selectedAt,
          archivedAt: m.archivedAt,
          user: user ? { name: user.name, email: user.email } : null,
        };
      }),
    );

    return {
      _id: tenant._id,
      name: tenant.name,
      uuid: tenant.uuid,
      type: tenant.type,
      _creationTime: tenant._creationTime,
      memberships: hydrated,
    };
  },
});

export const createTenant = adminMutation({
  args: {
    name: z.string().min(1),
    type: tenantTypeSchema.exclude(['admin']),
  },
  handler: async (ctx, args) => {
    return createTenantService(ctx, args);
  },
});
