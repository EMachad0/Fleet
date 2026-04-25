import { customCtx, NoOp } from 'convex-helpers/server/customFunctions';
import { zCustomAction, zCustomMutation, zCustomQuery } from 'convex-helpers/server/zod4';
import { ConvexError } from 'convex/values';

import { action, mutation, query } from './_generated/server';

export const zQuery = zCustomQuery(query, NoOp);
export const zMutation = zCustomMutation(mutation, NoOp);
export const zAction = zCustomAction(action, NoOp);

export type AuthedUser = { _id: string; name: string; email: string };
export type AuthedTenant = { _id: string; type: string; name: string };

const authedCtx = customCtx(async (ctx) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError('Unauthenticated');

  const tenantId = identity.tenantId as string | undefined;
  if (!tenantId) throw new ConvexError('No tenant selected');

  return {
    user: {
      _id: identity.subject,
      name: identity.name ?? '',
      email: identity.email ?? '',
    } satisfies AuthedUser,
    tenant: {
      _id: tenantId,
      type: (identity.tenantType as string) ?? '',
      name: (identity.tenantName as string) ?? '',
    } satisfies AuthedTenant,
  };
});

export const azQuery = zCustomQuery(query, authedCtx);
export const azMutation = zCustomMutation(mutation, authedCtx);
