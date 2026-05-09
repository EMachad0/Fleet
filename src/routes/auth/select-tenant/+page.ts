import { convexLoad } from '@mmailaender/convex-svelte/sveltekit';
import { api } from '$convex/_generated/api';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
  const memberships = await convexLoad(api.tenant_selection.memberships.listMyMemberships, {});
  const user = await convexLoad(api.auth.current_user.getCurrentUser, {});

  return { memberships, user };
};
