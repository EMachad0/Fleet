<script lang="ts">
  import './layout.css';
  // import favicon from '$lib/assets/favicon.svg';
  import { createSvelteAuthClient } from '@mmailaender/convex-better-auth-svelte/svelte';
  import { authClient } from '$lib/auth-client';

  let { children } = $props();

  // Wires up session lifecycle, the `useAuth()` context, and replaces the
  // minimal token fetcher set up in `src/hooks.ts` with the full
  // Better-Auth-aware one (sign-out guards, tab-refocus coordination,
  // retry/backoff). `expectAuth: true` and the singleton ConvexClient live
  // in `hooks.ts` — this call reuses them.
  createSvelteAuthClient({ authClient });
</script>

<!-- <svelte:head><link rel="icon" href={favicon} /></svelte:head> -->
{@render children()}
