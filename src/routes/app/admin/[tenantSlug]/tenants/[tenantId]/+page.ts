import { convexLoad } from '@mmailaender/convex-svelte/sveltekit';
import { api } from '$convex/_generated/api';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent, params }) => {
  const { currentMembership } = await parent();
  const tenant = await convexLoad(api.admin.getTenantWithMemberships, {
    adminSlug: currentMembership.tenant.slug,
    tenantId: params.tenantId,
  });
  return { tenant };
};
