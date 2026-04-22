import { z } from 'zod';
import { zid } from 'convex-helpers/server/zod4';

/**
 * Canonical list of tenant product types. Mirrors the union in
 * `src/convex/schema.ts` — kept in Zod form so the Convex action args,
 * SvelteKit form validators, and route-path typing all reference the same
 * source of truth.
 */
export const tenantTypeSchema = z.enum(['consumer', 'contractor']);
export type TenantType = z.infer<typeof tenantTypeSchema>;

export const loginSchema = z.object({
  email: z.email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const selectMembershipSchema = z.object({
  membershipId: zid('memberships'),
});

export type SelectMembershipInput = z.infer<typeof selectMembershipSchema>;
