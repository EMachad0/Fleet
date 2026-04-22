import type { Handle } from '@sveltejs/kit';
import { getToken } from '@mmailaender/convex-better-auth-svelte/sveltekit';
import { withServerConvexToken } from '@mmailaender/convex-svelte/sveltekit/server';
import { getSession } from '$lib/server/session';

export const handle: Handle = async ({ event, resolve }) => {
  // Publish the JWT into AsyncLocalStorage so SSR code (load functions,
  // createConvexHttpClient, getAuthState) can read it without explicit
  // plumbing. Consumers import from @mmailaender/convex-svelte/sveltekit.
  const token = getToken(event.cookies);

  return withServerConvexToken(token, async () => {
    event.locals.session = await getSession();
    return resolve(event);
  });
};
