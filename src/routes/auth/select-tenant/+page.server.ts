import { redirect } from '@sveltejs/kit';
import { createConvexHttpClient } from '@mmailaender/convex-svelte/sveltekit';
import { api } from '$convex/_generated/api';
import type { TenantType } from '$lib/schemas/auth';
import type { PageServerLoad } from './$types';

/**
 * Seed the membership list for SSR, grouped by tenant type in the canonical
 * enum order with empty buckets dropped. Grouping here (instead of on the
 * client) keeps `api.tenants.listMine` generic and hands the view a shape
 * it can render without any derived state.
 *
 * The actual selection is a client-side Convex mutation
 * (`api.tenants.selectTenant`) dispatched in `onUpdate` — no server action,
 * no extra hop. See superforms skill rule 4.
 */
export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.session) redirect(303, '/auth/login');

  const convex = createConvexHttpClient();
  const tenants = await convex.query(api.tenants.listMine, {});

  const groups = (['consumer', 'contractor'] as const satisfies readonly TenantType[])
    .map((type) => ({ type, tenants: tenants.filter((t) => t.type === type) }))
    .filter((group) => group.tenants.length > 0);

  return { groups };
};
