import { convexLoad } from '@mmailaender/convex-svelte/sveltekit';
import { api } from '$convex/_generated/api';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
  const { currentMembership } = await parent();
  const users = await convexLoad(api.admin.listAllUsers, {
    adminSlug: currentMembership.data!.tenant.slug,
  });
  return { users };
};
