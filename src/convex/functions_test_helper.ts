import { azQuery } from './functions';

export const echoAuthedCtx = azQuery({
  args: {},
  handler: async (ctx) => {
    return { user: ctx.user, tenant: ctx.tenant };
  },
});
