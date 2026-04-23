import { browser } from '$app/environment';
import { getConvexClient } from '@mmailaender/convex-svelte';
import {
  initConvex,
  encodeConvexLoad,
  decodeConvexLoad,
  encodeConvexLoadPaginated,
  decodeConvexLoadPaginated,
} from '@mmailaender/convex-svelte/sveltekit';
import type { Transport } from '@sveltejs/kit';
import type { AuthTokenFetcher } from 'convex/browser';
import { PUBLIC_CONVEX_URL } from '$env/static/public';
import { authClient } from '$lib/auth-client';

/**
 * Universal hooks — runs on both the server and the client at module load.
 *
 * `initConvex()` seeds the shared singleton (URL + lazy `ConvexClient`) so
 * anything that reaches for it later — `createConvexHttpClient()` in server
 * loads/hooks, `setupConvex()` in the root layout, transport decoders — gets
 * a ready client without extra plumbing.
 *
 * On the server the client is created with `disabled: true` (no websocket,
 * no subscriptions), so this is purely URL registration; the HTTP client
 * built per-request in `createConvexHttpClient()` does the actual talking.
 *
 * `expectAuth: true` MUST be set here, not on `createSvelteAuthClient` in
 * `+layout.svelte`. `setupConvex` (called internally by
 * `createSvelteAuthClient`) reuses this singleton and silently drops its
 * `options` argument — see the `setupConvex` source in
 * `@mmailaender/convex-svelte/dist/client.svelte.js`. With the socket paused
 * from the start, auth-gated queries queue until `setAuth` resumes them
 * instead of racing out unauthenticated and crashing with
 * `ConvexError: Unauthenticated`.
 */
initConvex(PUBLIC_CONVEX_URL, { expectAuth: true });

/**
 * Client pre-warm — kick off the Better Auth → Convex JWT fetch before any
 * load function runs.
 *
 * Why here and not in `+layout.svelte`: SvelteKit runs universal loads
 * (`+page.ts`, `+layout.ts`) before components mount. `convexLoad()` in
 * `+page.ts` does `await client.query(...)` on the client, which blocks
 * forever on a paused socket. `createSvelteAuthClient` in the layout only
 * calls `client.setAuth(...)` at mount time, so without a pre-warm the
 * load awaits a query that awaits auth that awaits a layout that awaits
 * the load — deadlock.
 *
 * Calling `setAuth` here kicks the token fetch off during module load, so
 * by the time any `convexLoad()` reaches its `await`, the fetcher is in
 * flight. Queued queries dispatch the moment the token lands. The fetcher
 * is intentionally minimal (happy-path only) — the layout's
 * `createSvelteAuthClient` replaces it on mount with the fully
 * Better-Auth-aware version (sign-out guards, tab-refocus coordination,
 * retry/backoff). When the user is unauthenticated, `authClient.convex.token()`
 * returns `null`, the socket stays paused, and nothing leaks out — which
 * is exactly what `expectAuth: true` is supposed to guarantee.
 */
if (browser) {
  const fetchAccessToken: AuthTokenFetcher = async ({ forceRefreshToken }) => {
    if (!forceRefreshToken) return null;
    try {
      const { data } = await authClient.convex.token();
      return data?.token ?? null;
    } catch {
      return null;
    }
  };
  getConvexClient().setAuth(fetchAccessToken);
}

/**
 * `transport` teaches SvelteKit how to serialize the custom result types
 * `convexLoad()` and `convexLoadPaginated()` return from `+page.server.ts`
 * (or `+page.ts`) load functions. Without an entry here, the class instance
 * would serialize as a bare object and the client-side decode step —
 * the one that upgrades the snapshot into a live Convex subscription —
 * would never fire, so `data.foo.data` would be correct on first paint but
 * frozen thereafter.
 *
 * Package-supplied encode/decode pair, so the contract lives in the
 * publisher's hands and we're not reinventing SuperJSON-for-Convex here.
 * See: https://svelte.dev/docs/kit/hooks#Universal-hooks-transport
 */
export const transport: Transport = {
  ConvexLoadResult: {
    encode: encodeConvexLoad,
    decode: decodeConvexLoad,
  },
  ConvexLoadPaginatedResult: {
    encode: encodeConvexLoadPaginated,
    decode: decodeConvexLoadPaginated,
  },
};
