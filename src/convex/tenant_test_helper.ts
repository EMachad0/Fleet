import { ConvexError, v } from 'convex/values';
import { mutation } from './_generated/server';

export const seed = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    type: v.union(v.literal('consumer'), v.literal('contractor'), v.literal('admin')),
  },
  handler: async (ctx, args) => {
    if (process.env.IS_TEST !== 'true') {
      throw new ConvexError('Test-only mutation');
    }
    return await ctx.db.insert('tenants', args);
  },
});
