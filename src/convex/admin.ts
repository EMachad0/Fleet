import { z } from 'zod';
import { zid } from 'convex-helpers/server/zod4';
import { v7 as uuidv7 } from 'uuid';
import { authComponent, createAuth } from './auth';
import {
  isMembershipActive,
  createMembership as createMembershipService,
  updateMembership,
} from './_services/membership_lifecycle/memberships';
import { adminAction, adminMutation, adminQuery } from './functions';

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

export const listUsersNotInTenant = adminQuery({
  args: { targetTenantId: zid('tenants') },
  handler: async (ctx, { targetTenantId }) => {
    const tenantMemberships = await ctx.db
      .query('memberships')
      .withIndex('by_tenant_user', (q) => q.eq('tenantId', targetTenantId))
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

export const createMembership = adminMutation({
  args: {
    userId: z.string(),
    targetTenantId: zid('tenants'),
    role: z.enum(['owner', 'admin', 'member']),
  },
  handler: async (ctx, { userId, targetTenantId, role }) => {
    return createMembershipService(ctx, { userId, tenantId: targetTenantId, role });
  },
});

export const archiveMembership = adminMutation({
  args: { membershipId: zid('memberships') },
  handler: async (ctx, { membershipId }) => {
    return updateMembership(ctx, { membershipId, patch: { archivedAt: Date.now() } });
  },
});

export const updateMembershipRole = adminMutation({
  args: {
    membershipId: zid('memberships'),
    role: z.enum(['owner', 'admin', 'member']),
  },
  handler: async (ctx, { membershipId, role }) => {
    return updateMembership(ctx, { membershipId, patch: { role } });
  },
});

export const listAllUsers = adminQuery({
  args: {},
  handler: async (ctx) => {
    const allMemberships = await ctx.db.query('memberships').collect();
    const userIds = [...new Set(allMemberships.map((m) => m.userId))];

    const users = await Promise.all(
      userIds.map(async (uid) => {
        const user = await authComponent.getAnyUserById(ctx, uid);
        if (!user) return null;
        const memberships = allMemberships.filter((m) => m.userId === uid);
        return {
          _id: user._id as string,
          name: user.name,
          email: user.email,
          membershipCount: memberships.filter(isMembershipActive).length,
        };
      }),
    );

    return users.filter((u): u is NonNullable<typeof u> => u !== null);
  },
});

export const createTenant = adminMutation({
  args: {
    name: z.string().min(1),
    type: z.enum(['consumer', 'contractor']),
  },
  handler: async (ctx, { name, type }) => {
    return ctx.db.insert('tenants', { name, uuid: uuidv7(), type });
  },
});

export const createUser = adminAction({
  args: {
    email: z.email(),
    name: z.string().min(1),
    password: z.string().min(8),
  },
  handler: async (ctx, { email, name, password }) => {
    const { auth } = await authComponent.getAuth(createAuth, ctx);
    const res = await auth.api.signUpEmail({ body: { email, password, name } });
    return { userId: res.user.id };
  },
});
