import { convexLoad } from '@mmailaender/convex-svelte/sveltekit';
import { api } from '$convex/_generated/api';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
  const tenant = await convexLoad(api.admin.tenant_dashboard.tenants.getTenantWithMemberships, {
    targetTenantId: params.tenantId,
  });
  return { tenant };
};
