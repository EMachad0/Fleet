import { ConvexError } from 'convex/values';
import { z } from 'zod';
import { zid } from 'convex-helpers/server/zod4';
import type { QueryCtx, MutationCtx } from './_generated/server';
import { authComponent } from './auth';
import { isMembershipActive } from './memberships';
import { zMutation, zQuery } from './functions';

async function assertAdminMembership(ctx: QueryCtx | MutationCtx, adminSlug: string) {
  const user = await authComponent.getAuthUser(ctx);

  const tenant = await ctx.db
    .query('tenants')
    .withIndex('by_slug', (q) => q.eq('slug', adminSlug))
    .unique();
  if (!tenant || tenant.type !== 'admin') {
    throw new ConvexError('Admin tenant not found');
  }

  const membership = await ctx.db
    .query('memberships')
    .withIndex('by_tenant_user', (q) => q.eq('tenantId', tenant._id).eq('userId', user._id))
    .unique();
  if (!membership || !isMembershipActive(membership)) {
    throw new ConvexError('Not an admin');
  }

  return { user, tenant, membership };
}

export const listTenants = zQuery({
  args: { adminSlug: z.string() },
  handler: async (ctx, { adminSlug }) => {
    await assertAdminMembership(ctx, adminSlug);

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
          slug: tenant.slug,
          type: tenant.type,
          memberCount: memberships.filter(isMembershipActive).length,
          totalMemberCount: memberships.length,
          _creationTime: tenant._creationTime,
        };
      }),
    );
  },
});

export const getTenantWithMemberships = zQuery({
  args: { adminSlug: z.string(), tenantId: zid('tenants') },
  handler: async (ctx, { adminSlug, tenantId }) => {
    await assertAdminMembership(ctx, adminSlug);

    const tenant = await ctx.db.get(tenantId);
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
      slug: tenant.slug,
      type: tenant.type,
      _creationTime: tenant._creationTime,
      memberships: hydrated,
    };
  },
});

export const listUsersNotInTenant = zQuery({
  args: { adminSlug: z.string(), tenantId: zid('tenants') },
  handler: async (ctx, { adminSlug, tenantId }) => {
    await assertAdminMembership(ctx, adminSlug);

    const tenantMemberships = await ctx.db
      .query('memberships')
      .withIndex('by_tenant_user', (q) => q.eq('tenantId', tenantId))
      .collect();
    const activeMemberUserIds = new Set(
      tenantMemberships.filter(isMembershipActive).map((m) => m.userId),
    );

    const allMemberships = await ctx.db.query('memberships').collect();
    const allUserIds = [...new Set(allMemberships.map((m) => m.userId))];

    const candidates = await Promise.all(
      allUserIds
        .filter((uid) => !activeMemberUserIds.has(uid))
        .map(async (uid) => {
          const user = await authComponent.getAnyUserById(ctx, uid);
          if (!user) return null;
          return { _id: user._id as string, name: user.name, email: user.email };
        }),
    );

    return candidates.filter((u): u is NonNullable<typeof u> => u !== null);
  },
});

export const createMembership = zMutation({
  args: {
    adminSlug: z.string(),
    userId: z.string(),
    tenantId: zid('tenants'),
    role: z.enum(['owner', 'admin', 'member']),
  },
  handler: async (ctx, { adminSlug, userId, tenantId, role }) => {
    await assertAdminMembership(ctx, adminSlug);

    const existing = await ctx.db
      .query('memberships')
      .withIndex('by_tenant_user', (q) => q.eq('tenantId', tenantId).eq('userId', userId))
      .unique();

    if (existing && isMembershipActive(existing)) {
      throw new ConvexError('User already has an active membership to this tenant');
    }

    if (existing) {
      await ctx.db.patch(existing._id, { archivedAt: undefined, role, selectedAt: Date.now() });
      return existing._id;
    }

    return ctx.db.insert('memberships', { userId, tenantId, role, selectedAt: Date.now() });
  },
});

export const archiveMembership = zMutation({
  args: { adminSlug: z.string(), membershipId: zid('memberships') },
  handler: async (ctx, { adminSlug, membershipId }) => {
    await assertAdminMembership(ctx, adminSlug);

    const membership = await ctx.db.get(membershipId);
    if (!membership) throw new ConvexError('Membership not found');

    await ctx.db.patch(membershipId, { archivedAt: Date.now() });
  },
});

export const updateMembershipRole = zMutation({
  args: {
    adminSlug: z.string(),
    membershipId: zid('memberships'),
    role: z.enum(['owner', 'admin', 'member']),
  },
  handler: async (ctx, { adminSlug, membershipId, role }) => {
    await assertAdminMembership(ctx, adminSlug);

    const membership = await ctx.db.get(membershipId);
    if (!membership) throw new ConvexError('Membership not found');

    await ctx.db.patch(membershipId, { role });
  },
});
