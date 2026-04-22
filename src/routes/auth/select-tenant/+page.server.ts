import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * Server-only responsibility for this route: the auth guard.
 *
 * The data fetches live in `+page.ts` via `convexLoad` so they run on
 * both sides: server-rendered for first paint, then upgraded to a live
 * Convex subscription on the client (via the `transport` hook in
 * `src/hooks.ts`), and on subsequent client-side navigation they skip
 * SvelteKit's `/__data.json` round-trip and go straight to the
 * authenticated Convex singleton. Keeping the guard here — where
 * `locals.session` actually exists — means protected markup never
 * ships to an anonymous caller and the redirect happens before any
 * render work.
 */
export const load: PageServerLoad = ({ locals }) => {
  if (!locals.session) redirect(303, '/');
};
