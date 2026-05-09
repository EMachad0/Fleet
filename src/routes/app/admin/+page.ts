import { convexLoad } from '@mmailaender/convex-svelte/sveltekit';
import { api } from '$convex/_generated/api';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
  const tenants = await convexLoad(api.admin.tenant_dashboard.tenants.listTenants, {});
  return { tenants };
};
