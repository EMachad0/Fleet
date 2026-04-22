import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** Already signed in? Bounce to `/`; the entry resolver picks the right app target. */
export const load: PageServerLoad = ({ locals }) => {
  if (locals.session) redirect(303, '/');
};
