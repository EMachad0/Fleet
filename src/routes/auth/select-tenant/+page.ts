import { convexLoad } from '@mmailaender/convex-svelte/sveltekit';
import { api } from '$convex/_generated/api';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
  const [memberships, user] = await Promise.all([
    convexLoad(api.memberships.listMyMemberships, {}),
    convexLoad(api.auth.getCurrentUser, {}),
  ]);

  return { memberships, user };
};
