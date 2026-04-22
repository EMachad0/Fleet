import { error, redirect } from '@sveltejs/kit';
import { createConvexHttpClient } from '@mmailaender/convex-svelte/sveltekit';
import { api } from '$convex/_generated/api';
import { tenantTypeSchema } from '$lib/schemas/auth';
import type { LayoutServerLoad } from './$types';

/**
 * Single server guard for everything under `/app`. Two jobs:
 *
 *   1. No session → `/auth/login?next=…`.
 *   2. Verify the URL's `(tenantType, tenantSlug)` resolves to a tenant
 *      the caller is actually a member of. Any miss — tenant absent,
 *      tenant type mismatches the URL's product surface, or caller has
 *      no membership — is a flat 404. We don't leak tenant existence to
 *      non-members.
 *
 * If the layout runs at all, the URL matched one of the concrete child
 * route templates (`/app/consumer/[tenantSlug]/…` or
 * `/app/contractor/[tenantSlug]/…`), so `params.tenantSlug` is set and
 * the path's second segment is a valid tenant type — we still parse
 * defensively so a future route addition can't silently bypass the check.
 *
 * Returned shape: `{ currentMembership }`. Children read from
 * `data.currentMembership.{ tenant, user, role }`.
 */
export const load: LayoutServerLoad = async ({ locals, url, params }) => {
  if (!locals.session) {
    const next = encodeURIComponent(url.pathname + url.search);
    redirect(303, `/auth/login?next=${next}`);
  }

  const [, , typeSegment] = url.pathname.split('/');
  const typeResult = tenantTypeSchema.safeParse(typeSegment);
  const slug = params.tenantSlug;
  if (!typeResult.success || !slug) error(404, 'Not found');

  const convex = createConvexHttpClient();
  const currentMembership = await convex.query(api.memberships.getMembership, { slug });
  if (!currentMembership || currentMembership.tenant.type !== typeResult.data) {
    error(404, 'Not found');
  }

  return { currentMembership };
};
