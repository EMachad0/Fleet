import { getAuthState } from '@mmailaender/convex-better-auth-svelte/sveltekit';
import { createConvexHttpClient } from '@mmailaender/convex-svelte/sveltekit';
import { api } from '$convex/_generated/api';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ setHeaders }) => {
  // Auth state is per-user; never let any cache layer share this response.
  setHeaders({ 'cache-control': 'private, no-store' });

  const authState = getAuthState();
  if (!authState.isAuthenticated) {
    return { authState, currentUser: null };
  }

  // createConvexHttpClient auto-reads the JWT from withServerConvexToken's
  // AsyncLocalStorage slot set up in hooks.server.ts.
  const convex = createConvexHttpClient();
  const currentUser = await convex.query(api.auth.getCurrentUser, {});
  return { authState, currentUser };
};
