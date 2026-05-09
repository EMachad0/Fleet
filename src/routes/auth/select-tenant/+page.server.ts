import { fail, redirect } from '@sveltejs/kit';
import { createConvexHttpClient } from '@mmailaender/convex-svelte/sveltekit';
import { api } from '$convex/_generated/api';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, fetch, url }) => {
  if (!locals.session) redirect(303, '/');

  const convex = createConvexHttpClient();
  const landing = await convex.query(api.auth.current_user.getDefaultLanding, {});

  if (landing) {
    await fetch('/api/auth/update-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        origin: url.origin,
      },
      body: JSON.stringify({
        tenantId: landing.tenantId,
        tenantType: landing.type,
        tenantName: landing.name,
        role: landing.role,
      }),
    });
    redirect(303, `/app/${landing.type}`);
  }
};

export const actions: Actions = {
  default: async ({ request, fetch, url }) => {
    const formData = await request.formData();
    const membershipId = formData.get('membershipId');

    if (!membershipId || typeof membershipId !== 'string') {
      return fail(400, { error: 'Please select a workspace.' });
    }

    const convex = createConvexHttpClient();
    const membership = await convex.mutation(api.tenant_selection.memberships.selectMembership, {
      membershipId: membershipId,
    });

    await fetch('/api/auth/update-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        origin: url.origin,
      },
      body: JSON.stringify({
        tenantId: membership.tenant._id,
        tenantType: membership.tenant.type,
        tenantName: membership.tenant.name,
        role: membership.role,
      }),
    });

    await fetch('/api/auth/convex/token', {
      headers: { origin: url.origin },
    });

    redirect(303, '/');
  },
};
