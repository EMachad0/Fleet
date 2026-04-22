import type { RequestHandler } from './$types';
import { PUBLIC_CONVEX_SITE_URL } from '$env/static/public';

/**
 * Proxy Better Auth HTTP routes to Convex's HTTP actions endpoint.
 *
 * This is a local reimplementation of
 * `@mmailaender/convex-better-auth-svelte/sveltekit`'s `createSvelteKitHandler`
 * (v0.7.3). The published handler does roughly:
 *
 *   const newRequest = new Request(nextUrl, request);   // adopts body stream
 *   …mutate newRequest.headers…
 *   return fetch(newRequest, { method, redirect: 'manual' });
 *
 * Under Node's undici fetch (which SvelteKit's dev server uses), wrapping an
 * incoming `Request` in another `Request` adopts — and effectively consumes —
 * its underlying body `ReadableStream`. When undici then tries to send it,
 * the stream is already disturbed and the fetch fails with:
 *
 *   TypeError: fetch failed
 *     cause: Error: expected non-null body source
 *
 * The surface-level symptom is that *every* POST to `/api/auth/*` returns 500
 * from the SvelteKit layer, so the login form only ever sees a generic
 * "Internal Server Error" instead of Better Auth's 401 with the real code
 * (`INVALID_EMAIL_OR_PASSWORD` etc.).
 *
 * The fix is to buffer the request body once, up front, and forward via a
 * plain `fetch(url, init)` call — no Request-wrapping ping-pong. The header
 * forwarding rules below match upstream byte-for-byte so the Better Auth
 * handler on the Convex side sees exactly the same request it would have
 * without the proxy, including the `x-better-auth-forwarded-*` hints it uses
 * to reconstruct the public base URL behind the proxy.
 */

const FORWARDED_HEADER_NAMES = new Set([
  'accept',
  'authorization',
  'better-auth-cookie',
  'content-type',
  'cookie',
  'origin',
  'referer',
  'user-agent',
]);

const proxy: RequestHandler = async ({ request, url }) => {
  if (!PUBLIC_CONVEX_SITE_URL) {
    throw new Error('PUBLIC_CONVEX_SITE_URL environment variable is not set');
  }

  const nextUrl = `${PUBLIC_CONVEX_SITE_URL}${url.pathname}${url.search}`;
  const targetHost = new URL(nextUrl).host;

  const headers = new Headers();
  for (const [name, value] of request.headers) {
    if (FORWARDED_HEADER_NAMES.has(name.toLowerCase())) headers.set(name, value);
  }
  headers.set('host', targetHost);
  headers.set('x-forwarded-host', url.host);
  headers.set('x-forwarded-proto', url.protocol.replace(/:$/, ''));
  headers.set('x-better-auth-forwarded-host', url.host);
  headers.set('x-better-auth-forwarded-proto', url.protocol.replace(/:$/, ''));
  // Ask upstream not to gzip; we're a passthrough and don't want to pay to
  // decode a body we're about to re-stream to the browser.
  headers.set('accept-encoding', 'identity');

  // Buffering is cheap here (auth payloads are tiny) and avoids undici's
  // "already-disturbed stream" failure mode described in the file comment.
  // `GET`/`HEAD` can't carry a body per the Fetch spec, so skip the read.
  const method = request.method;
  const body = method === 'GET' || method === 'HEAD' ? undefined : await request.arrayBuffer();

  return fetch(nextUrl, { method, headers, body, redirect: 'manual' });
};

export const GET = proxy;
export const POST = proxy;
