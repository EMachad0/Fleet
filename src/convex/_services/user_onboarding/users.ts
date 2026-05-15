import type { ActionCtx, QueryCtx } from '$convex/_generated/server';
import type { Id } from '$convex/_generated/dataModel';
import { authComponent, createAuth } from '$convex/auth';
import { isMembershipActive } from '$convex/_services/membership_lifecycle/memberships';

export async function listUsersNotInTenant(ctx: QueryCtx, args: { targetTenantId: Id<'tenants'> }) {
  const tenantMemberships = await ctx.db
    .query('memberships')
    .withIndex('by_tenant_user', (q) => q.eq('tenantId', args.targetTenantId))
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
        return { _id: user._id, name: user.name, email: user.email };
      }),
  );

  return candidates.filter((u): u is NonNullable<typeof u> => u !== null);
}

export async function createUser(
  ctx: ActionCtx,
  args: { email: string; name: string; password: string },
) {
  const { auth } = await authComponent.getAuth(createAuth, ctx);
  const res = await auth.api.signUpEmail({ body: args });
  return { userId: res.user.id };
}
