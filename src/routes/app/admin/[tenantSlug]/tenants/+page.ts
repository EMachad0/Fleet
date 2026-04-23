import { convexLoad } from '@mmailaender/convex-svelte/sveltekit';
import { api } from '$convex/_generated/api';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
  const { currentMembership } = await parent();
  const tenants = await convexLoad(api.admin.listTenants, {
    adminSlug: currentMembership.data!.tenant.slug,
  });
  return { tenants };
};
