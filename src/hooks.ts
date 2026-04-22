import {
  initConvex,
  encodeConvexLoad,
  decodeConvexLoad,
  encodeConvexLoadPaginated,
  decodeConvexLoadPaginated,
} from '@mmailaender/convex-svelte/sveltekit';
import type { Transport } from '@sveltejs/kit';
import { PUBLIC_CONVEX_URL } from '$env/static/public';

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
 * Idempotent: subsequent calls with the same URL are no-ops, so the client
 * `setupConvex()` path in `+layout.svelte` reuses this instance instead of
 * building its own.
 */
initConvex(PUBLIC_CONVEX_URL);

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
