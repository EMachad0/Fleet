import { ConvexError, v } from 'convex/values';
import { v7 as uuidv7 } from 'uuid';
import { mutation } from '../_generated/server';

export const createTenant = mutation({
  args: {
    name: v.string(),
    type: v.union(v.literal('consumer'), v.literal('contractor'), v.literal('admin')),
  },
  handler: async (ctx, args) => {
    if (process.env.IS_TEST !== 'true') {
      throw new ConvexError('Test-only mutation');
    }
    return await ctx.db.insert('tenants', { ...args, uuid: uuidv7() });
  },
});
