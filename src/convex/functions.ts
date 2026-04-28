import { customCtx, NoOp } from 'convex-helpers/server/customFunctions';
import { zCustomAction, zCustomMutation, zCustomQuery } from 'convex-helpers/server/zod4';
import { ConvexError } from 'convex/values';

import type { Id } from './_generated/dataModel';
import { action, mutation, query } from './_generated/server';

export const zQuery = zCustomQuery(query, NoOp);
export const zMutation = zCustomMutation(mutation, NoOp);
export const zAction = zCustomAction(action, NoOp);

export type AuthedUser = { _id: string; name: string; email: string };
export type AuthedTenant = { _id: Id<'tenants'>; type: string; name: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveAuthedCtx(ctx: Record<string, any>) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError('Unauthenticated');
  if (!identity.tenantId) throw new ConvexError('No tenant selected');

  return {
    user: {
      _id: identity.subject,
      name: identity.name,
      email: identity.email,
    } as AuthedUser,
    tenant: {
      _id: identity.tenantId,
      type: identity.tenantType,
      name: identity.tenantName,
    } as AuthedTenant,
  };
}

const authedCtx = customCtx(resolveAuthedCtx);

export const azQuery = zCustomQuery(query, authedCtx);
export const azMutation = zCustomMutation(mutation, authedCtx);
export const azAction = zCustomAction(action, authedCtx);

const adminCtx = customCtx(async (ctx) => {
  const result = await resolveAuthedCtx(ctx);
  if (result.tenant.type !== 'admin') throw new ConvexError('Not an admin');
  return result;
});

export const adminQuery = zCustomQuery(query, adminCtx);
export const adminMutation = zCustomMutation(mutation, adminCtx);
export const adminAction = zCustomAction(action, adminCtx);
