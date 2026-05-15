import type { Role, TenantType } from './tenant';

export type TenantSession = {
  tenantId: string;
  tenantType: TenantType;
  tenantName: string;
  role: Role;
};
