import { ConvexError } from 'convex/values';
import { internalQuery } from '../_generated/server';

export const echoCtx = internalQuery({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError('Unauthenticated');
    if (!identity.tenantId) throw new ConvexError('No tenant selected');

    return {
      user: { _id: identity.subject, name: identity.name, email: identity.email },
      tenant: { _id: identity.tenantId, type: identity.tenantType, name: identity.tenantName },
    };
  },
});
