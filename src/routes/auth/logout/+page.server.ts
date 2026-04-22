import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** Not signed in? Nothing to sign out of — bounce to `/`; the entry resolver sends guests to login. */
export const load: PageServerLoad = ({ locals }) => {
  if (!locals.session) redirect(303, '/');
};
