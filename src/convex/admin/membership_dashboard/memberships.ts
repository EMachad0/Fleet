import { z } from 'zod';
import { zid } from 'convex-helpers/server/zod4';
import { adminMutation } from '$convex/functions';
import { roleSchema } from '$convex/schemas/tenant';
import {
  createMembership as createMembershipService,
  updateMembership,
} from '$convex/_services/membership_lifecycle/memberships';

export const createMembership = adminMutation({
  args: {
    userId: z.string(),
    targetTenantId: zid('tenants'),
    role: roleSchema,
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
    role: roleSchema,
  },
  handler: async (ctx, { membershipId, role }) => {
    return updateMembership(ctx, { membershipId, patch: { role } });
  },
});
