import { ConvexError } from 'convex/values';
import type { MutationCtx } from '$convex/_generated/server';
import type { Doc, Id } from '$convex/_generated/dataModel';

type Membership = Doc<'memberships'>;
type MembershipWithArchiveState = Pick<Membership, 'archivedAt'>;
type MembershipWithSelectionState = Pick<Membership, 'archivedAt' | 'selectedAt'>;
type MembershipPatch = Partial<Omit<Membership, '_id' | '_creationTime' | 'userId' | 'tenantId'>>;

export function isMembershipActive<M extends MembershipWithArchiveState>(membership: M): boolean {
  return membership.archivedAt === undefined;
}

export function listActiveMembershipsByRecency<M extends MembershipWithSelectionState>(
  memberships: readonly M[],
): M[] {
  return memberships.filter(isMembershipActive).sort((a, b) => b.selectedAt - a.selectedAt);
}

export async function createMembership(
  ctx: MutationCtx,
  args: { userId: string; tenantId: Id<'tenants'>; role: Membership['role'] },
) {
  const existing = await ctx.db
    .query('memberships')
    .withIndex('by_tenant_user', (q) => q.eq('tenantId', args.tenantId).eq('userId', args.userId))
    .unique();

  if (existing && isMembershipActive(existing)) {
    throw new ConvexError('User already has an active membership to this tenant');
  }

  if (existing) {
    await ctx.db.patch(existing._id, {
      archivedAt: undefined,
      role: args.role,
      selectedAt: Date.now(),
    });
    return existing._id;
  }

  return ctx.db.insert('memberships', {
    userId: args.userId,
    tenantId: args.tenantId,
    role: args.role,
    selectedAt: Date.now(),
  });
}

export async function updateMembership(
  ctx: MutationCtx,
  args: { membershipId: Id<'memberships'>; patch: MembershipPatch },
) {
  const membership = await ctx.db.get(args.membershipId);
  if (!membership) throw new ConvexError('Membership not found');

  const cleaned = Object.fromEntries(Object.entries(args.patch).filter(([, v]) => v !== undefined));
  if (Object.keys(cleaned).length === 0) return;

  await ctx.db.patch(args.membershipId, cleaned);
}
