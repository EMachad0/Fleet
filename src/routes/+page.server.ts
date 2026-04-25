import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.session) redirect(303, '/auth/login');

  const { tenantId, tenantType } = locals.session;
  if (tenantId && tenantType) redirect(303, `/app/${tenantType}`);

  redirect(303, '/auth/select-tenant');
};
