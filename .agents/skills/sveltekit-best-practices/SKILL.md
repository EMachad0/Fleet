---
name: sveltekit-best-practices
description:
  SvelteKit and Svelte 5 done right. Runes, load functions, form actions, SSR patterns, and modern
  Svelte.
metadata:
  tags: sveltekit, svelte, runes, best-practices
---

## When to use

Use this skill when working with SvelteKit or Svelte 5 code. AI agents are trained on Svelte 4
patterns and frequently generate outdated code using stores, reactive declarations, and export let.
This skill enforces Svelte 5 runes, load functions, and form actions.

## Critical Rules

### 1. Use Svelte 5 runes - never Svelte 4 stores or reactive declarations

**Wrong (agents do this):**

```svelte
<script>
  import { writable, derived } from 'svelte/store';
  let count = writable(0);
  $: doubled = $count * 2;
  $: if (count > 5) alert('too high');
</script>

<p>{$count}</p>
```

**Correct:**

```svelte
<script>
  let count = $state(0);
  let doubled = $derived(count * 2);
  $effect(() => {
    if (count > 5) alert('too high');
  });
</script>

<p>{count}</p>
```

**Why:** Svelte 5 runes ($state, $derived, $effect) replace stores and $: syntax. Agents default to
Svelte 4 patterns.

### 2. Use $state for reactive state - not let with reactive assignments

**Wrong:**

```svelte
<script>
  let count = 0;
  count = count + 1;
</script>
```

**Correct:**

```svelte
<script>
  let count = $state(0);
  count = count + 1;
</script>
```

**Why:** In Svelte 5, reactivity is opt-in via $state. Plain let is not reactive.

### 3. Use $derived for computed values - not $: reactive declarations

**Wrong:**

```svelte
<script>
  let firstName = $state('John');
  let lastName = $state('Doe');
  $: fullName = `${firstName} ${lastName}`;
</script>
```

**Correct:**

```svelte
<script>
  let firstName = $state('John');
  let lastName = $state('Doe');
  let fullName = $derived(`${firstName} ${lastName}`);
</script>
```

**Why:** $: is Svelte 4. Svelte 5 uses $derived for derivations.

### 4. Use $effect for side effects - not $: reactive statements

**Wrong:**

```svelte
<script>
  let count = $state(0);
  $: if (count > 5) console.log('count is high');
</script>
```

**Correct:**

```svelte
<script>
  let count = $state(0);
  $effect(() => {
    if (count > 5) console.log('count is high');
  });
</script>
```

**Why:** $effect runs when dependencies change. $: for side effects is deprecated.

### 5. Use $props() for component props - not export let

**Wrong:**

```svelte
<script>
  export let title = 'Default';
  export let count;
</script>

<h1>{title}</h1>
```

**Correct:**

```svelte
<script>
  let { title = 'Default', count } = $props();
</script>

<h1>{title}</h1>
```

**Why:** export let is Svelte 4. Svelte 5 uses $props().

### 6. Use $bindable() for two-way binding props

**Wrong:**

```svelte
<script>
  let { value } = $props();
</script>

<input bind:value />
```

**Correct:**

```svelte
<script>
  let { value = $bindable() } = $props();
</script>

<input bind:value />
```

**Why:** Props are one-way by default. $bindable() enables bind:value from parent.

### 7. Use load functions (+page.server.ts) for data fetching - not onMount fetch

**Wrong:**

```svelte
<script>
  import { onMount } from 'svelte';
  let data = $state(null);
  onMount(async () => {
    data = await fetch('/api/users').then((r) => r.json());
  });
</script>

{#if data}{data.name}{/if}
```

**Correct:**

```typescript
// +page.server.ts
import type { PageServerLoad } from './$types';
export const load: PageServerLoad = async ({ fetch }) => ({
  data: await fetch('/api/users').then((r) => r.json()),
});
```

```svelte
<!-- +page.svelte -->
<script>
  let { data } = $props();
</script>

{#if data}{data.name}{/if}
```

**Why:** Load runs on server for SSR, avoids loading flicker, and integrates with SvelteKit routing.

### 8. Use form actions for mutations - not API routes for form submissions

**Wrong:**

```svelte
<form on:submit={async (e) => {
  e.preventDefault();
  await fetch('/api/login', { method: 'POST', body: new FormData(e.target) });
  goto('/dashboard');
}}>
```

**Correct (vanilla SvelteKit 2 form action):**

```typescript
// +page.server.ts
import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions = {
  default: async ({ request, cookies }) => {
    const data = await request.formData();
    const email = data.get('email');
    if (!email) return fail(400, { missing: true });
    cookies.set('sessionid', 'xxx', { path: '/' });
    redirect(303, '/dashboard');
  },
} satisfies Actions;
```

```svelte
<script lang="ts">
  import { enhance } from '$app/forms';
</script>
<form method="POST" use:enhance>
```

**Correct (Superforms, which this repo uses):**

```typescript
// +page.server.ts
import { fail, redirect } from '@sveltejs/kit';
import { superValidate, message, setError } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { loginSchema } from '$lib/schemas';

export const actions = {
  default: async ({ request, cookies }) => {
    const form = await superValidate(request, zod(loginSchema));
    if (!form.valid) return fail(400, { form });
    if (await userExists(form.data.email)) {
      return setError(form, 'email', 'Email already registered');
    }
    cookies.set('sessionid', 'xxx', { path: '/' });
    redirect(303, '/dashboard');
  },
};
```

**Key rules:**

- In SvelteKit 2, `redirect()` and `error()` are **no longer thrown by you** — calling the function is
  enough. Do not write `throw redirect(...)` or wrap in `try/catch`. See
  [migration note](https://svelte.dev/docs/kit/migrating-to-sveltekit-2#redirect-and-error-are-no-longer-thrown-by-you).
- Use status `303` for POST → GET redirects (e.g. after login). `307`/`308` keep the request method
  and will re-POST to the target. See
  [redirect reference](https://svelte.dev/docs/kit/@sveltejs-kit#redirect).
- `fail(status, data)` is the correct way to return validation errors with previous form values.
  `setError` / `message` (Superforms) wrap this pattern.
- For redirects that need a flash message (e.g. "Post created!"), use `sveltekit-flash-message`'s
  `redirect()` instead of `@sveltejs/kit`'s — see
  [Superforms flash integration](https://superforms.rocks/flash-messages).

**Why:** Form actions enable progressive enhancement, work without JS, and avoid client-side fetch
boilerplate. See [SvelteKit form actions docs](https://svelte.dev/docs/kit/form-actions).

### 9. Use +layout.server.ts for shared layout data

**Wrong:**

```svelte
<!-- Multiple pages each fetch user -->
<script>
  let user = $state(null);
  onMount(() => fetchUser().then((u) => (user = u)));
</script>
```

**Correct:**

```typescript
// +layout.server.ts
export const load = async ({ locals }) => ({
  user: locals.user,
});
```

**Why:** Layout load runs once, data is available to all child pages. No duplicate fetches.

### 10. Use +error.svelte for error pages - read from `page.error`, not `$props()`

**Wrong (common agent mistake):**

```svelte
<!-- +error.svelte -->
<script>
  let { status, message } = $props();
</script>

<h1>{status}</h1><p>{message}</p>
```

`+error.svelte` does **not** receive `status`/`message` as destructured props. An error from a `load`
function / expected `error()` call is exposed via the reactive `page` object.

**Correct (default, for load/action errors):**

```svelte
<!-- +error.svelte -->
<script lang="ts">
  import { page } from '$app/state';
</script>

<h1>{page.status}</h1><p>{page.error?.message}</p>
```

**Correct (only when `experimental.handleRenderingErrors` is enabled, SvelteKit 2.54+ / Svelte 5.53+):**

With rendering-error boundaries enabled, errors thrown during component rendering are passed to
`+error.svelte` as a single `error` prop (not `status` / `message`):

```svelte
<!-- +error.svelte -->
<script lang="ts">
  let { error } = $props();
</script>

<h1>{error.message}</h1>
```

To enable it, in `svelte.config.js`:

```js
export default {
  kit: { experimental: { handleRenderingErrors: true } },
};
```

**Why:** See [SvelteKit error handling docs](https://svelte.dev/docs/kit/errors). Errors thrown in
`load` populate `page.error` (plus `page.status`); only rendering errors with the experimental flag
flow through as a prop. Shape the error object via `App.Error` in `src/app.d.ts`.

### 11. Use +page.ts for universal load, +page.server.ts for server-only concerns

`+page.server.ts` runs only on the server — every client-side navigation to the route triggers a
`/__data.json` fetch. Use it when the load genuinely needs server-only state (`locals`, cookies,
secrets, a Node API).

`+page.ts` runs universally: on the server for SSR, then in the browser on client-side navigation
— no SvelteKit data round-trip on nav. Use it for data both sides can fetch.

**The two can coexist on the same route.** If you need a server-side guard plus universal data,
put the guard in `+page.server.ts` and the fetch in `+page.ts`. SvelteKit merges the returned
objects; the universal load can read server data via its `data` arg and parent layout data via
`await event.parent()`. This is the shape `/auth/select-tenant` uses in this repo: guard in
`+page.server.ts`, `convexLoad` calls in `+page.ts`.

**Hydration-order caveat to know about.** On a cold page load (new tab, refresh, Playwright
`page.goto()`), SvelteKit runs every `+page.ts` / `+layout.ts` load **before** mounting any
component. If a universal load awaits something a layout only wires up at mount (a Convex auth
token attached in `+layout.svelte`, a singleton configured in `onMount`, etc.), you get a silent
hydration deadlock. This repo defuses it for Convex by pre-warming `client.setAuth(...)` in
`src/hooks.ts` — see rule 15. Any other library with the same "configure in layout mount" shape
needs the same treatment, or its loads move to `+page.server.ts`.

**Rule of thumb:**

- Auth-gated Convex data → `+page.ts` with `convexLoad`, paired with a `+page.server.ts` guard
  when the route is members-only (rule 15).
- Public or derived data where the snapshot doesn't need the socket → `+page.ts` is fine on its
  own.
- Guard that depends on `locals` → always `+page.server.ts`.
- Anything that depends on state a layout wires up at mount and isn't already pre-warmed at the
  hooks layer → `+page.server.ts`.

### 12. Use hooks.server.ts for middleware (auth, redirects)

**Correct:**

```typescript
// hooks.server.ts
export const handle = async ({ event, resolve }) => {
  event.locals.user = await getUser(event);
  if (!event.locals.user && event.url.pathname.startsWith('/dashboard')) {
    return redirect(302, '/login');
  }
  return resolve(event);
};
```

**Why:** Handle runs before every request. Use for auth, redirects, and setting locals.

### 13. Use `$app/state` (not `$app/stores`) for reactive page / navigation state

**Wrong (deprecated as of SvelteKit 2.12):**

```svelte
<script>
  import { page } from '$app/stores';
</script>

<p>{$page.url.pathname}</p>
```

**Correct:**

```svelte
<script lang="ts">
  import { page } from '$app/state';
</script>

<p>{page.url.pathname}</p>
```

**Key rules:**

- `$app/state` replaces `$app/stores` and is rune-based. No `$` prefix — `page.url`, not `$page.url`.
- Available: `page`, `navigating`, `updated`.
- Changes to `page` are only reactive inside runes (`$derived(page.params.id)`). The legacy `$:`
  syntax will not re-run — this is a common agent trap.
- `$app/stores` is deprecated and scheduled for removal in SvelteKit 3. Prefer load prop data when
  possible; use `page`/`navigating` only for genuine routing state.
- Migration: `npx sv migrate app-state` auto-converts usages in `.svelte` files.

**References:**

- [`$app/state` reference](https://svelte.dev/docs/kit/$app-state)
- [Migration note (2.12 deprecation)](https://svelte.dev/docs/kit/migrating-to-sveltekit-2#SvelteKit-2.12:-$app/stores-deprecated)

### 14. Use snippet blocks for reusable template chunks (Svelte 5)

**Wrong (Svelte 4 slots):**

```svelte
<script>
  export let slots;
</script>

<slot name="header" />
```

**Wrong (invalid Svelte 5 — `@render` is a template tag, not a JS expression):**

<!-- prettier-ignore -->
```svelte
<script>
  let { header = @render(() => {}) } = $props();
</script>

{@render header()}
```

**Correct (optional snippet via optional chaining):**

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';
  let { header, children }: { header?: Snippet; children?: Snippet } = $props();
</script>

{@render header?.()}<div>{@render children?.()}</div>
```

**Correct (fallback content via `{#if}` / `{:else}`):**

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';
  let { children }: { children?: Snippet } = $props();
</script>

{#if children}
  {@render children()}
{:else}
  <p>fallback content</p>
{/if}
```

**Correct (snippet parameter with a default value — this is allowed, default props to `@render()` is not):**

```svelte
{#snippet hello(name = 'World')}
  <p>Hello {name}!</p>
{/snippet}
{@render hello()}
```

**Why:** Svelte 5 snippets replace slots. `@render` is a template tag used only inside markup. For
optional snippets, use optional chaining `{@render children?.()}` or an `{#if}` block with a
`:else` fallback. Snippet _parameters_ can have defaults; snippet _props_ cannot be defaulted to a
`@render(...)` call.

**References:**

- [`{#snippet ...}` docs](https://svelte.dev/docs/svelte/snippet) — see "Optional snippet props"
- [`{@render ...}` docs](https://svelte.dev/docs/svelte/@render) — see "Optional snippets"

### 15. Seed Convex data with `convexLoad` in `+page.ts`, guarded by `+page.server.ts`

This is the default shape for any SvelteKit route in this repo that reads auth-gated Convex data.
`convexLoad` from `@mmailaender/convex-svelte/sveltekit` gives you an SSR-seeded first paint plus
a live Convex subscription that keeps the page in sync for as long as the user stays on it. The
universal load re-runs cheaply on SPA navigation, so there's no `/__data.json` round trip per nav.

**Correct (guard in server load, data in universal load):**

```typescript
// +page.server.ts
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.session) redirect(303, '/');
};
```

```typescript
// +page.ts
import { convexLoad } from '@mmailaender/convex-svelte/sveltekit';
import { api } from '$convex/_generated/api';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
  const [memberships, user] = await Promise.all([
    convexLoad(api.memberships.listMyMemberships, {}),
    convexLoad(api.auth.getCurrentUser, {}),
  ]);

  return { memberships, user };
};
```

```svelte
<!-- +page.svelte -->
<script lang="ts">
  let { data } = $props();
  const memberships = $derived(data.memberships.data ?? []);
  const user = $derived(data.user.data);
</script>
```

`data.foo.data` reads the snapshot on both sides, and it stays live until the subscription is
disposed. The Playwright reactivity spec in
`tests/routes/auth/select-tenant/select-tenant.spec.ts` pins this — renaming the backing row
propagates to the DOM without a page reload. Call `convexLoad` N times in parallel for fan-out
(e.g. "tasks per tenant" across four tenants) — each return value becomes its own live
subscription. Keep grouping / empty-state detection in a pure helper colocated with the route
(`./helper.ts` next to `+page.svelte`); do **not** push presentation logic into the Convex query.
See `project-structure` rule 6 and the `testing` skill for where the helper lives and how to
unit-test it.

**Prereq — three-piece setup in `src/hooks.ts`:**

```typescript
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

// 1. Seed the singleton. `expectAuth: true` pauses the websocket until
//    `setAuth(...)` attaches the Convex JWT, so queries never race out
//    unauthenticated.
initConvex(PUBLIC_CONVEX_URL, { expectAuth: true });

// 2. Client pre-warm — kicks the token fetch off at module load, *before*
//    any `+page.ts` / `+layout.ts` load runs. Without this, auth-gated
//    universal loads deadlock on cold page loads (see "Why the pre-warm"
//    below). On unauth pages the fetcher resolves to `null`, the socket
//    stays paused, and nothing leaks — which is exactly what `expectAuth`
//    promises.
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

// 3. Teach SvelteKit to encode/decode `ConvexLoadResult` across the SSR
//    boundary so the client-side decode can upgrade the snapshot into a
//    live subscription via `createDetachedQuery`.
export const transport: Transport = {
  ConvexLoadResult: { encode: encodeConvexLoad, decode: decodeConvexLoad },
  ConvexLoadPaginatedResult: {
    encode: encodeConvexLoadPaginated,
    decode: decodeConvexLoadPaginated,
  },
};
```

All three pieces have to be right:

1. **Transport hook.** Without the encode/decode pair, `ConvexLoadResult` crosses the SSR
   boundary as a bare object, the client never upgrades to a live subscription, and you get a
   silently-frozen first paint.
2. **`{ expectAuth: true }` on `initConvex`.** `setupConvex` (called internally by
   `createSvelteAuthClient` in `+layout.svelte`) reuses the singleton and **silently discards**
   its `options` argument — see
   `node_modules/@mmailaender/convex-svelte/dist/client.svelte.js`, `setupConvex`. So
   `expectAuth` set only on `createSvelteAuthClient` never takes effect. Without it on the
   singleton, any client-side path that doesn't go through the deferred-subscription queue
   (e.g. `useQuery`, a `convexLoad` racing the session fetch) fires before `setAuth` attaches
   the token and crashes with `ConvexError: Unauthenticated`.
3. **Client pre-warm.** Without it, `convexLoad` in `+page.ts` deadlocks on cold page loads. See
   below.

**Why the pre-warm is load-bearing.** On a cold load (new tab, refresh, Playwright `page.goto`,
any Set-Cookie + full document nav), SvelteKit runs every universal load in the tree **before**
mounting any component. On the client `convexLoad(ref, args)` calls
`await getConvexClient().query(ref, args)` — see
`node_modules/@mmailaender/convex-svelte/dist/sveltekit/transport.svelte.js`, lines 52–59. With
the socket paused by `expectAuth: true` and no `setAuth` yet, that promise sits.
`client.setAuth(...)` is what `createSvelteAuthClient` in `+layout.svelte` arranges, but its
script runs at component mount, which SvelteKit schedules **after** every load resolves. Load
awaits query → query awaits auth → auth awaits layout mount → layout mount awaits load.
Hydration hangs silently — no error, no console output, just an SSR'd page that never becomes
interactive and never receives live updates. The pre-warm calls `setAuth(...)` at hooks-module
load, before any load function is dispatched, so the token fetch is in flight the moment the
load's `await client.query(...)` queues its query. Queued queries dispatch as soon as the token
lands; hydration completes; the layout mounts and
`createSvelteAuthClient` replaces the minimal fetcher with its Better-Auth-aware version
(sign-out guards, tab-refocus coordination, retry/backoff).

**Layout stays minimal:**

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import { createSvelteAuthClient } from '@mmailaender/convex-better-auth-svelte/svelte';
  import { authClient } from '$lib/auth-client';

  let { children } = $props();
  createSvelteAuthClient({ authClient });
</script>

{@render children()}
```

No `getServerState`, no `options: { expectAuth: true }`, no `+layout.server.ts` feeding it —
`expectAuth` lives on the singleton (hooks.ts), the pre-warm handles cold-load auth, and the
layout's `createSvelteAuthClient` owns ongoing session lifecycle plus the `useAuth()` context.

**When to use `+page.server.ts` for Convex data instead:**

- The load needs `locals`, cookies, or secrets the universal load can't touch.
- You want to avoid the universal load re-running on SPA navigation (rare; `convexLoad` on the
  client re-uses the authenticated singleton so the nav cost is a single `client.query` roundtrip
  plus the subscription handover — fine in practice).

If you do move `convexLoad` into `+page.server.ts`, the transport path carries it — `decodeConvexLoad`
runs synchronously and hands the subscription to `createDetachedQuery`, which queues it via
`deferSubscription` until `setupAuth` flushes deferred subscriptions on mount. Same `data.foo.data`
shape in the component.

**Reference:**

- [`@mmailaender/convex-svelte` README](https://github.com/mmailaender/convex-better-auth-svelte)
- Library source:
  `node_modules/@mmailaender/convex-svelte/dist/sveltekit/transport.svelte.js`
  (`convexLoad` lines 52–59 — the `await client.query(...)` branch is what the pre-warm unblocks)
- Convex `ConvexClient.query` deferral:
  `node_modules/convex/dist/esm/browser/simple_client.js` (`async query(...)`)
- SvelteKit hydration order (loads before component mounts):
  `node_modules/@sveltejs/kit/src/runtime/client/client.js` (`_hydrate`, `load_node`)

## Patterns

- Page data: +page.server.ts load returns object, +page.svelte receives via $props() with `data`
- Form with enhance: `method="POST"` and `use:enhance` from `$app/forms`
- Streaming: Return promises from load without await; use `{#await data.promise}` in template
- TypeScript: Use `import type { PageServerLoad, PageProps } from './$types'`

## Anti-Patterns

- Do not use writable, readable, derived, get from svelte/store
- Do not use $: for derivations or side effects
- Do not use export let for props
- Do not fetch in onMount when data is needed for SSR
- Do not create +server.ts API routes just for form POST handling
- Do not use bind:value with a prop unless the prop is $bindable()
- Do not `throw redirect(...)` / `throw error(...)` — in SvelteKit 2, calling them is sufficient
- Do not destructure `{ status, message }` from `$props()` in `+error.svelte` — use `page.error`
- Do not import from `$app/stores` in new code — use `$app/state` (requires runes)
- Do not default a snippet prop to `@render(...)` — `@render` is not a JS expression

## References

### Svelte 5

- [Runes overview](https://svelte.dev/docs/svelte/what-are-runes) — `$state`, `$derived`, `$effect`,
  `$props`, `$bindable`
- [`{#snippet ...}`](https://svelte.dev/docs/svelte/snippet) — snippet declaration, typing, optional
  props
- [`{@render ...}`](https://svelte.dev/docs/svelte/@render) — rendering snippets, optional chaining
- [v5 migration guide](https://svelte.dev/docs/svelte/v5-migration-guide)

### SvelteKit 2

- [Form actions](https://svelte.dev/docs/kit/form-actions) — `fail`, named actions, `use:enhance`
- [Load functions](https://svelte.dev/docs/kit/load) — `+page.ts` vs `+page.server.ts`, streaming,
  redirects
- [Errors](https://svelte.dev/docs/kit/errors) — `+error.svelte`, `page.error`,
  `handleRenderingErrors`
- [`$app/state`](https://svelte.dev/docs/kit/$app-state) — `page`, `navigating`, `updated`
- [`@sveltejs/kit` API](https://svelte.dev/docs/kit/@sveltejs-kit) — `redirect`, `error`, `fail`,
  `isRedirect`
- [Hooks](https://svelte.dev/docs/kit/hooks) — `handle`, `handleError`, `handleFetch`
- [Remote functions](https://svelte.dev/docs/kit/remote-functions) — `query`, `form`, `command`,
  `prerender` from `$app/server` (2.27+)
- [SvelteKit 2 migration guide](https://svelte.dev/docs/kit/migrating-to-sveltekit-2) — includes
  [`redirect`/`error` no longer thrown](https://svelte.dev/docs/kit/migrating-to-sveltekit-2#redirect-and-error-are-no-longer-thrown-by-you)
  and
  [`$app/stores` deprecation](https://svelte.dev/docs/kit/migrating-to-sveltekit-2#SvelteKit-2.12:-$app/stores-deprecated)

### Superforms (used in this repo)

- [Superforms docs](https://superforms.rocks/)
- [Error handling — `setError`, `fail`](https://superforms.rocks/concepts/error-handling)
- [Status messages — `message()`](https://superforms.rocks/concepts/messages)
- [Events — `onSubmit`, `onResult`, `onUpdated`](https://superforms.rocks/concepts/events)
- [Flash messages (redirects with toasts)](https://superforms.rocks/flash-messages)

### Convex (used in this repo)

Auth-gated Convex data goes through `convexLoad` in `+page.ts`, with a thin `+page.server.ts`
holding the guard — see rule 15 for the full shape, including the three-piece `src/hooks.ts`
setup (`initConvex({ expectAuth: true })`, the client-side `setAuth` pre-warm, and the transport
hook). `useQuery` inside `+page.svelte` is still fine for data that doesn't need SSR seeding
(e.g. mounted-only panels, dropdowns whose contents don't affect first paint).
