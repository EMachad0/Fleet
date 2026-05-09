import { query } from '../_generated/server';
import { authComponent } from '../auth';
import { resolveDefaultLanding } from '../_services/auth/landing_resolver';

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    return user ?? null;
  },
});

export const getDefaultLanding = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) return null;

    return resolveDefaultLanding(ctx, user._id);
  },
});
