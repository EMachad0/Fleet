import { createClient, type GenericCtx } from '@convex-dev/better-auth';
import { convex } from '@convex-dev/better-auth/plugins';
import { components } from './_generated/api';
import type { DataModel } from './_generated/dataModel';
import { betterAuth } from 'better-auth/minimal';
import authConfig from './auth.config';
import authSchema from './betterAuth/schema';

import type { TenantSession } from '../lib/schemas/auth';

export function buildConvexJwtPayload({
  user,
  session,
}: {
  user: { id: string; image?: string | null; [key: string]: unknown };
  session: Partial<TenantSession> & { [key: string]: unknown };
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
      } satisfies Record<keyof TenantSession, { type: 'string'; required: false }>,
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
