import { getAuthState } from '@mmailaender/convex-better-auth-svelte/sveltekit';
import type { LayoutServerLoad } from './$types';

/**
 * `getAuthState()` reads the JWT set up by `withServerConvexToken` in
 * `hooks.server.ts`, so the client sees the correct auth state on first paint
 * — no flicker, no client-side round-trip.
 *
 * No `setHeaders({ 'cache-control': … })` here on purpose. SvelteKit already
 * returns `cache-control: private, no-store` for every `__data.json` response
 * (see `@sveltejs/kit/src/runtime/server/data/index.js`), which is where the
 * per-user auth payload actually lives. Calling `setHeaders` from a layout
 * load additionally throws `"cache-control" header is already set` when the
 * same header is set elsewhere in the pipeline (e.g. after a redirect) — the
 * `headers` bag is shared across the whole request. Response-wide cache
 * controls belong in `hooks.server.ts`, not in a load.
 */
export const load: LayoutServerLoad = () => {
  return { authState: getAuthState() };
};
