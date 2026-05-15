import { z } from 'zod';
import { zid } from 'convex-helpers/server/zod4';
import { adminMutation } from '$convex/functions';
import {
  createMembership as createMembershipService,
  updateMembership,
} from '$convex/_services/membership_lifecycle/memberships';

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
