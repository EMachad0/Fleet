import { convexLoad } from '@mmailaender/convex-svelte/sveltekit';
import { api } from '$convex/_generated/api';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent, params }) => {
  const { currentMembership } = await parent();
  const adminSlug = currentMembership.data!.tenant.slug;
  const [tenant, candidates] = await Promise.all([
    convexLoad(api.admin.getTenantWithMemberships, {
      adminSlug,
      tenantId: params.tenantId,
    }),
    convexLoad(api.admin.listUsersNotInTenant, {
      adminSlug,
      tenantId: params.tenantId,
    }),
  ]);
  return { tenant, candidates };
};
