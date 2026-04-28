import { createClient, type GenericCtx } from '@convex-dev/better-auth';
import { convex } from '@convex-dev/better-auth/plugins';
import { components } from './_generated/api';
import type { DataModel } from './_generated/dataModel';
import { query } from './_generated/server';
import { betterAuth } from 'better-auth/minimal';
import authConfig from './auth.config';
import authSchema from './betterAuth/schema';

export function buildConvexJwtPayload({
  user,
  session,
}: {
  user: { id: string; image?: string | null; [key: string]: unknown };
  session: {
    tenantId?: string;
    tenantType?: string;
    tenantName?: string;
    role?: string;
    [key: string]: unknown;
  };
}): Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, image, ...rest } = user;
  return {
    ...rest,
    tenantId: session.tenantId,
    tenantType: session.tenantType,
    tenantName: session.tenantName,
    role: session.role,
  };
}

const siteUrl = process.env.SITE_URL!;
const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(siteUrl);

// The component client has methods needed for integrating Convex with Better Auth,
// as well as helper methods for general use.
export const authComponent = createClient<DataModel, typeof authSchema>(components.betterAuth, {
  local: { schema: authSchema },
});

export function createAuthOptions() {
  return {
    baseURL: siteUrl,
    rateLimit: {
      enabled: !isLocal,
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    session: {
      additionalFields: {
        tenantId: { type: 'string' as const, required: false as const },
        tenantType: { type: 'string' as const, required: false as const },
        tenantName: { type: 'string' as const, required: false as const },
        role: { type: 'string' as const, required: false as const },
      },
    },
    plugins: [
      convex({
        authConfig,
        jwt: { definePayload: buildConvexJwtPayload },
      }),
    ],
  };
}

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    ...createAuthOptions(),
    database: authComponent.adapter(ctx),
  });
};

/**
 * Returns the authenticated user or `null` for anonymous callers.
 *
 * Uses `safeGetAuthUser` rather than `getAuthUser` — the latter throws a
 * `ConvexError("Unauthenticated")` and is meant for mutation guards, not
 * for "who am I?" lookups that run on every request (including logged-
 * out ones during login / registration flows).
 */
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    return user ?? null;
  },
});

/**
 * Returns the landing destination for an authenticated caller:
 *
 *   - `null` — zero active memberships (send the user to
 *     `/auth/select-tenant`, which will show the "contact your admin"
 *     copy) OR two+ active memberships (force an explicit pick).
 *   - `{ type, name, tenantId, role }` — the user's single active
 *     membership. Auto-land.
 *
 * Returns `null` entirely when the caller isn't authenticated.
 */
export const getDefaultLanding = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) return null;

    const memberships = await ctx.db
      .query('memberships')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect();

    const active = pickOnlyActiveMembership(memberships);
    if (!active) return null;

    const tenant = await ctx.db.get(active.tenantId);
    if (!tenant) return null;

    return {
      type: tenant.type,
      name: tenant.name,
      tenantId: tenant._id,
      role: active.role,
    };
  },
});

export function pickOnlyActiveMembership<M extends { archivedAt?: number; tenantId: unknown }>(
  memberships: readonly M[],
): M | null {
  const active = memberships.filter((m) => m.archivedAt === undefined);
  return active.length === 1 ? active[0]! : null;
}
