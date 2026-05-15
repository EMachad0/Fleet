import { z } from 'zod';
import { zid } from 'convex-helpers/server/zod4';

import type { Role, TenantType } from './tenant';

export type TenantSession = {
  tenantId: string;
  tenantType: TenantType;
  tenantName: string;
  role: Role;
};

export const loginSchema = z.object({
  email: z.email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const selectMembershipSchema = z.object({
  membershipId: zid('memberships'),
});

export type SelectMembershipInput = z.infer<typeof selectMembershipSchema>;
