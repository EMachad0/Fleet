import type { Handle } from '@sveltejs/kit';
import { getToken } from '@mmailaender/convex-better-auth-svelte/sveltekit';
import { withServerConvexToken } from '@mmailaender/convex-svelte/sveltekit/server';

export const handle: Handle = ({ event, resolve }) => {
  // Publish the JWT into AsyncLocalStorage so SSR code (load functions,
  // createConvexHttpClient, getAuthState) can read it without explicit
  // plumbing. Consumers import from @mmailaender/convex-svelte/sveltekit.
  const token = getToken(event.cookies);
  return withServerConvexToken(token, () => resolve(event));
};
