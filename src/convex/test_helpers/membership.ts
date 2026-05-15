import { z } from 'zod';
import { zid } from 'convex-helpers/server/zod4';
import { ConvexError } from 'convex/values';
import { zMutation } from '$convex/functions';
import { roleSchema } from '$convex/schemas/tenant';

export const createMembership = zMutation({
  args: {
    userId: z.string(),
    tenantId: zid('tenants'),
    role: roleSchema,
  },
  handler: async (ctx, args) => {
    if (process.env.IS_TEST !== 'true') {
      throw new ConvexError('Test-only mutation');
    }
    return await ctx.db.insert('memberships', {
      ...args,
      selectedAt: Date.now(),
    });
  },
});
