import { convexLoad } from '@mmailaender/convex-svelte/sveltekit';
import { api } from '$convex/_generated/api';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
  const tenant = await convexLoad(api.admin.getTenantWithMemberships, {
    targetTenantId: params.tenantId,
  });
  return { tenant };
};
