import type { QueryCtx } from '$convex/_generated/server';

function pickOnlyActiveMembership<M extends { archivedAt?: number }>(
  memberships: readonly M[],
): M | null {
  const active = memberships.filter((m) => m.archivedAt === undefined);
  return active.length === 1 ? active[0]! : null;
}

export async function resolveDefaultLanding(ctx: QueryCtx, userId: string) {
  const memberships = await ctx.db
    .query('memberships')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .collect();

  const active = pickOnlyActiveMembership(memberships);
  if (!active) return null;

  const tenant = await ctx.db.get(active.tenantId);
  if (!tenant) return null;

  return {
    type: tenant.type,
    name: tenant.name,
    tenantId: tenant._id,
    role: active.role,
  };
}
