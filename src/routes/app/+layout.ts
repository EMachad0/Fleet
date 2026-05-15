import { error } from '@sveltejs/kit';
import { convexLoad } from '@mmailaender/convex-svelte/sveltekit';
import { api } from '$convex/_generated/api';
import { tenantTypeSchema } from '$lib/schemas/tenant';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ url }) => {
  const [, , typeSegment] = url.pathname.split('/');
  const typeResult = tenantTypeSchema.safeParse(typeSegment);
  if (!typeResult.success) error(404, 'Not found');

  const currentMembership = await convexLoad(
    api.tenant_selection.memberships.getCurrentMembership,
    {},
  );
  const membershipCount = await convexLoad(api.tenant_selection.memberships.countMyMemberships, {});

  if (!currentMembership.data || currentMembership.data.tenant.type !== typeResult.data) {
    error(404, 'Not found');
  }

  return { currentMembership, membershipCount };
};
