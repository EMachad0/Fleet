import { redirect } from '@sveltejs/kit';
import { createConvexHttpClient } from '@mmailaender/convex-svelte/sveltekit';
import { api } from '$convex/_generated/api';
import type { PageServerLoad } from './$types';

/**
 * Entry resolver. No session → login. Logged in with a default tenant →
 * `/app/[type]/[slug]`. Logged in but 0 memberships, or 2+ and none
 * explicitly picked yet → select-tenant.
 */
export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.session) redirect(303, '/auth/login');

  const convex = createConvexHttpClient();
  const landing = await convex.query(api.auth.getDefaultLanding, {});
  if (!landing) redirect(303, '/auth/select-tenant');

  redirect(303, `/app/${landing.type}/${landing.slug}`);
};
