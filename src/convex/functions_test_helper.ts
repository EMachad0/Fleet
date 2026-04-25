import { adminQuery, azQuery } from './functions';

export const echoAuthedCtx = azQuery({
  args: {},
  handler: async (ctx) => {
    return { user: ctx.user, tenant: ctx.tenant };
  },
});

export const echoAdminCtx = adminQuery({
  args: {},
  handler: async (ctx) => {
    return { user: ctx.user, tenant: ctx.tenant };
  },
});
