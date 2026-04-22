<script lang="ts">
  import './layout.css';
  // import favicon from '$lib/assets/favicon.svg';
  import { createSvelteAuthClient } from '@mmailaender/convex-better-auth-svelte/svelte';
  import { authClient } from '$lib/auth-client';

  let { children, data } = $props();

  // The entire app (everything under /app, plus the select-tenant step) is
  // members-only, so make Convex wait for auth before dispatching any query
  // or mutation on the client. Queries auto-attach the JWT and never fire
  // unauthenticated — no "skip" boilerplate needed.
  // https://labs.convex.dev/better-auth/framework-guides/sveltekit#option-2-make-all-requests-authenticated-with-expectauth
  createSvelteAuthClient({
    authClient,
    getServerState: () => data.authState,
    options: { expectAuth: true },
  });
</script>

<!-- <svelte:head><link rel="icon" href={favicon} /></svelte:head> -->
{@render children()}
