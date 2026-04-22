import { getAuthState } from '@mmailaender/convex-better-auth-svelte/sveltekit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ setHeaders }) => {
  // Auth state is per-user; never let any cache layer share this response.
  setHeaders({ 'cache-control': 'private, no-store' });

  // `getAuthState()` reads the JWT set up by `withServerConvexToken` in
  // hooks.server.ts, so the client sees the correct auth state on first paint
  // — no flicker, no client-side round-trip.
  return { authState: getAuthState() };
};
