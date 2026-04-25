import { v } from 'convex/values';
import { mutation } from './_generated/server';

export const seedTenant = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    type: v.union(v.literal('consumer'), v.literal('contractor'), v.literal('admin')),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('tenants', args);
  },
});

export const seedMembership = mutation({
  args: {
    userId: v.string(),
    tenantId: v.id('tenants'),
    role: v.union(v.literal('owner'), v.literal('admin'), v.literal('member')),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('memberships', {
      ...args,
      selectedAt: Date.now(),
    });
  },
});
