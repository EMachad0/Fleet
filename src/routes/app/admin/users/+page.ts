import { convexLoad } from '@mmailaender/convex-svelte/sveltekit';
import { api } from '$convex/_generated/api';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
  const users = await convexLoad(api.admin.membership_dashboard.users.listUsers, {});
  return { users };
};
