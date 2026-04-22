import { createClient, type GenericCtx } from '@convex-dev/better-auth';
import { convex } from '@convex-dev/better-auth/plugins';
import { components } from './_generated/api';
import type { DataModel, Doc, Id } from './_generated/dataModel';
import { query } from './_generated/server';
import { betterAuth } from 'better-auth/minimal';
import authConfig from './auth.config';

const siteUrl = process.env.SITE_URL!;
const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(siteUrl);

// The component client has methods needed for integrating Convex with Better Auth,
// as well as helper methods for general use.
export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    baseURL: siteUrl,
    database: authComponent.adapter(ctx),
    // Convex HTTP actions don't expose a client IP to handlers, so Better Auth
    // can't key rate-limits per-IP during local dev. Keep it on in production.
    rateLimit: {
      enabled: !isLocal,
    },
    // Configure simple, non-verified email/password to get started
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    plugins: [
      // The Convex plugin is required for Convex compatibility
      convex({ authConfig }),
    ],
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
 *   - `null` — no memberships; send the user to `/auth/select-tenant`
 *     (which will show a "contact your admin" message).
 *   - `{ type, slug }` — the default tenant to land on. Picks the
 *     membership with the greatest `selectedAt`. If no membership has ever
 *     been explicitly selected AND the user has exactly one, that one
 *     wins. Two+ memberships with no stamp → `null` (force a choice).
 *
 * Returns `null` entirely when the caller isn't authenticated.
 */
export const getDefaultLanding = query({
  args: {},
  handler: async (ctx): Promise<DefaultLanding | null> => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) return null;

    const memberships = await ctx.db
      .query('memberships')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect();

    if (memberships.length === 0) return null;

    const active = pickDefault(memberships);
    if (!active) return null;

    const tenant = await ctx.db.get(active.tenantId);
    if (!tenant) return null;

    return { type: tenant.type, slug: tenant.slug };
  },
});

type DefaultLanding = { type: Doc<'tenants'>['type']; slug: string };

function pickDefault<M extends { tenantId: Id<'tenants'>; selectedAt?: number }>(
  memberships: M[],
): M | null {
  // Explicit stamp wins.
  let best: M | null = null;
  for (const m of memberships) {
    if (m.selectedAt === undefined) continue;
    if (!best || m.selectedAt > (best.selectedAt ?? -Infinity)) best = m;
  }
  if (best) return best;

  // No stamp yet. Auto-resolve only when there's exactly one membership —
  // otherwise ask the user to pick.
  return memberships.length === 1 ? memberships[0] : null;
}
