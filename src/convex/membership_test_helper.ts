import { ConvexError, v } from 'convex/values';
import { mutation } from './_generated/server';

export const createMembership = mutation({
  args: {
    userId: v.string(),
    tenantId: v.id('tenants'),
    role: v.union(v.literal('owner'), v.literal('admin'), v.literal('member')),
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
