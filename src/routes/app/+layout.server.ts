import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

/**
 * Session guard for everything under `/app`. Redirects unauthenticated
 * visitors to login with a `?next=` param so they land back here after
 * sign-in. Membership validation and Convex data loading live in the
 * universal `+layout.ts` so they go through `convexLoad` and stay
 * reactive on the client.
 */
export const load: LayoutServerLoad = async ({ locals, url }) => {
  if (!locals.session) {
    const next = encodeURIComponent(url.pathname + url.search);
    redirect(303, `/auth/login?next=${next}`);
  }

  if (!locals.session.tenantId) {
    redirect(303, '/auth/select-tenant');
  }
};
