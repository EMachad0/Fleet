import { redirect } from '@sveltejs/kit';
import { createConvexHttpClient } from '@mmailaender/convex-svelte/sveltekit';
import { api } from '$convex/_generated/api';
import type { TenantType } from '$lib/schemas/auth';
import type { PageServerLoad } from './$types';

/**
 * Seed the caller's memberships for SSR, grouped by tenant type in the
 * canonical enum order with empty buckets dropped. Grouping here (instead
 * of on the client) keeps `api.memberships.listMyMemberships` generic and
 * hands the view a shape it can render without any derived state.
 *
 * Alongside, fetch the caller's identity (`api.auth.getCurrentUser`) so the
 * page can render a "Signed in as …" line — both a UX confirmation that the
 * right account is active and a cheap smoke test for auth plumbing. The two
 * Convex queries run in parallel (`Promise.all`) so SSR pays for one round
 * trip, not two in series.
 *
 * The actual selection is a client-side Convex mutation
 * (`api.memberships.selectMembership`) dispatched in `onUpdate` — no
 * server action, no extra hop. See superforms skill rule 4.
 */
export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.session) redirect(303, '/');

  const convex = createConvexHttpClient();
  const [user, memberships] = await Promise.all([
    convex.query(api.auth.getCurrentUser, {}),
    convex.query(api.memberships.listMyMemberships, {}),
  ]);

  const groups = (['consumer', 'contractor'] as const satisfies readonly TenantType[])
    .map((type) => ({
      type,
      memberships: memberships.filter((m) => m.tenant.type === type),
    }))
    .filter((group) => group.memberships.length > 0);

  return {
    user: user ? { name: user.name, email: user.email } : null,
    groups,
  };
};
