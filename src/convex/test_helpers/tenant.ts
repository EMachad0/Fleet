import { z } from 'zod';
import { ConvexError } from 'convex/values';
import { v7 as uuidv7 } from 'uuid';
import { zMutation } from '$convex/functions';
import { tenantTypeSchema } from '$convex/schemas/tenant';

export const createTenant = zMutation({
  args: {
    name: z.string(),
    type: tenantTypeSchema,
  },
  handler: async (ctx, args) => {
    if (process.env.IS_TEST !== 'true') {
      throw new ConvexError('Test-only mutation');
    }
    return await ctx.db.insert('tenants', { ...args, uuid: uuidv7() });
  },
});
