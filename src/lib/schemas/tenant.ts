import { z } from 'zod';

export const tenantTypeSchema = z.enum(['consumer', 'contractor', 'admin']);
export type TenantType = z.infer<typeof tenantTypeSchema>;

export const roleSchema = z.enum(['owner', 'admin', 'member']);
export type Role = z.infer<typeof roleSchema>;
