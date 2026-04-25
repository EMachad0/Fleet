import { redirect } from '@sveltejs/kit';
import { createConvexHttpClient } from '@mmailaender/convex-svelte/sveltekit';
import { api } from '$convex/_generated/api';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, fetch, url }) => {
  if (!locals.session) redirect(303, '/');

  const convex = createConvexHttpClient();
  const landing = await convex.query(api.auth.getDefaultLanding, {});

  if (landing) {
    const res = await fetch('/api/auth/update-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        origin: url.origin,
      },
      body: JSON.stringify({ tenantId: landing.tenantId }),
    });
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.error('[select-tenant] updateSession failed:', res.status, await res.text().catch(() => '(no body)'));
    }
    redirect(303, `/app/${landing.type}/${landing.slug}`);
  }
};
