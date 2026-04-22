import { initConvex } from '@mmailaender/convex-svelte/sveltekit';
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
