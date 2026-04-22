import { convexLoad } from '@mmailaender/convex-svelte/sveltekit';
import { api } from '$convex/_generated/api';
import type { PageLoad } from './$types';

/**
 * Seed Convex data for this page via `convexLoad`, which is the shape
 * we want for SSR-served Convex reads in this app:
 *
 *   - On the server, HTTP-fetches the current snapshot and returns a
 *     `ConvexLoadResult` marker. The `transport` hook in `src/hooks.ts`
 *     serializes it across the SSR boundary; the matching decoder on
 *     the client upgrades it into a live `DetachedQueryResult` — same
 *     Convex WebSocket subscription you'd get from `useQuery`, but with
 *     no first-paint flicker because the initial snapshot is already in
 *     the payload.
 *
 *   - On client-side navigation the load runs in the browser, skips
 *     SvelteKit's `/__data.json` round-trip, and queries the
 *     authenticated Convex singleton directly. You pay network once,
 *     not twice.
 *
 * Running both queries in parallel via `Promise.all` keeps SSR on a
 * single request. `data.memberships.data` and `data.user.data` are the
 * live-upgraded snapshots consumed in `+page.svelte`.
 *
 * The auth guard lives in `+page.server.ts` because it depends on
 * `locals.session`, which `+page.ts` doesn't see.
 */
export const load: PageLoad = async () => {
  const [memberships, user] = await Promise.all([
    convexLoad(api.memberships.listMyMemberships, {}),
    convexLoad(api.auth.getCurrentUser, {}),
  ]);

  return { memberships, user };
};
