import type { Handle } from '@sveltejs/kit';
import { getToken } from '@mmailaender/convex-better-auth-svelte/sveltekit';
import { withServerConvexToken } from '@mmailaender/convex-svelte/sveltekit/server';
import { parseSessionFromJwt } from '$lib/server/session';

export const handle: Handle = async ({ event, resolve }) => {
  const token = getToken(event.cookies);

  return withServerConvexToken(token, async () => {
    event.locals.session = token ? parseSessionFromJwt(token) : null;
    return resolve(event);
  });
};
