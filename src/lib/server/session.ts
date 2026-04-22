import { createConvexHttpClient } from '@mmailaender/convex-svelte/sveltekit';
import { api } from '$convex/_generated/api';

/**
 * Per-browser auth state. Which tenant the user is currently operating in
 * is a URL concern (`/app/[type]/[slug]/*`) — it lives in the route, not
 * in the session. That's what makes two tabs in two tenants possible.
 */
export type Session = {
  userId: string;
};

/**
 * Asks Convex who the caller is. The HTTP client reads the JWT from the
 * AsyncLocalStorage scope established by `withServerConvexToken` in
 * `hooks.server.ts`; without a token it returns `null` for anonymous
 * requests with no extra plumbing.
 */
export async function getSession(): Promise<Session | null> {
  const user = await createConvexHttpClient().query(api.auth.getCurrentUser, {});
  return user ? { userId: user._id } : null;
}
