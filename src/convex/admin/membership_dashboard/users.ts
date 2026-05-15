import { z } from 'zod';
import { zid } from 'convex-helpers/server/zod4';
import { adminAction, adminQuery } from '$convex/functions';
import { authComponent } from '$convex/auth';
import { isMembershipActive } from '$convex/_services/membership_lifecycle/memberships';
import {
  listUsersNotInTenant as listUsersNotInTenantService,
  createUser as createUserService,
} from '$convex/_services/user_onboarding/users';

export const listUsers = adminQuery({
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
          _id: user._id,
          name: user.name,
          email: user.email,
          membershipCount: memberships.filter(isMembershipActive).length,
        };
      }),
    );

    return users.filter((u): u is NonNullable<typeof u> => u !== null);
  },
});

export const listUsersNotInTenant = adminQuery({
  args: { targetTenantId: zid('tenants') },
  handler: async (ctx, { targetTenantId }) => {
    return listUsersNotInTenantService(ctx, { targetTenantId });
  },
});

export const createUser = adminAction({
  args: {
    email: z.email(),
    name: z.string().min(1),
    password: z.string().min(8),
  },
  handler: async (ctx, args) => {
    return createUserService(ctx, args);
  },
});
