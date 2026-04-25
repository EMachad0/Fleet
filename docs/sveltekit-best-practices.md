## When to use

Use this doc when working with SvelteKit or Svelte 5 code. AI agents are trained on Svelte 4 patterns and frequently generate outdated code using stores, reactive declarations, and export let. This doc enforces Svelte 5 runes, load functions, and form actions.

## Critical Rules

### 1. Use $state for reactive state

**Wrong:** `let count = 0;`  
**Correct:** `let count = $state(0);`

### 2. Use $derived for computed values

**Wrong:** `$: fullName = \`${firstName} ${lastName}\`;`  
**Correct:** `let fullName = $derived(\`${firstName} ${lastName}\`);`

### 3. Use $effect for side effects

**Wrong:** `$: if (count > 5) console.log('high');`  
**Correct:** `$effect(() => { if (count > 5) console.log('high'); });`

### 4. Use $props() for component props

**Wrong:** `export let title = 'Default';`  
**Correct:** `let { title = 'Default' } = $props();`

### 5. Use $bindable() for two-way binding props

**Wrong:** `let { value } = $props();` with `bind:value`  
**Correct:** `let { value = $bindable() } = $props();`

### 6. Use snippet blocks for reusable template chunks

**Wrong (Svelte 4 slots):** `<slot name="header" />`  
**Correct:** `let { header }: { header?: Snippet } = $props();` then `{@render header?.()}`

Don't: Default a snippet prop to `@render(...)` — `@render` is not a JS expression.

### 7. ⚠️ CRITICAL: redirect() and error() are called, NOT thrown (SvelteKit 2)

**Wrong:**

```typescript
throw redirect(303, '/dashboard');
```

**Correct:**

```typescript
redirect(303, '/dashboard');
```

**Key rules:**

- In SvelteKit 2, `redirect()` and `error()` are **no longer thrown by you** — calling the function is enough. Do not write `throw redirect(...)` or wrap in `try/catch`.
- Use status `303` for POST → GET redirects (e.g. after login). `307`/`308` keep the request method and will re-POST to the target.
- Models trained on Svelte 5 still get this wrong frequently — always check redirects.

**Reference:** [Migration note](https://svelte.dev/docs/kit/migrating-to-sveltekit-2#redirect-and-error-are-no-longer-thrown-by-you)

### 8. Use load functions (+page.server.ts) for data fetching

Don't: Fetch in `onMount` when data is needed for SSR.  
**Why:** Load runs on server for SSR, avoids loading flicker, and integrates with SvelteKit routing.

### 9. Use form actions for mutations

Don't: Create `+server.ts` API routes just for form POST handling.

**Correct (vanilla SvelteKit 2 form action):**

```typescript
// +page.server.ts
import { fail, redirect } from '@sveltejs/kit';
export const actions = {
  default: async ({ request, cookies }) => {
    const data = await request.formData();
    const email = data.get('email');
    if (!email) return fail(400, { missing: true });
    cookies.set('sessionid', 'xxx', { path: '/' });
    redirect(303, '/dashboard');
  },
};
```

**Correct (Superforms, which this repo uses):**

```typescript
// +page.server.ts
import { fail, redirect } from '@sveltejs/kit';
import { superValidate, setError } from 'sveltekit-superforms';
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

**Why:** Form actions enable progressive enhancement, work without JS, and avoid client-side fetch boilerplate.

### 10. Use +layout.server.ts for shared layout data

Don't: Fetch the same data (e.g. user) in multiple pages.  
**Why:** Layout load runs once, data is available to all child pages. No duplicate fetches.

### 11. Use +error.svelte for error pages — read from `page.error`, not `$props()`

**Wrong (common agent mistake):**

```svelte
<!-- +error.svelte -->
<script>
  let { status, message } = $props();
</script>
```

**Correct (default, for load/action errors):**

```svelte
<!-- +error.svelte -->
<script lang="ts">
  import { page } from '$app/state';
</script>

<h1>{page.status}</h1><p>{page.error?.message}</p>
```

**Why:** Errors thrown in `load` populate `page.error` (plus `page.status`). Only rendering errors with the experimental `handleRenderingErrors` flag flow through as a prop.

### 12. Use +page.ts for universal load, +page.server.ts for server-only concerns

`+page.server.ts` runs only on the server — every client-side navigation triggers a `/__data.json` fetch. Use it when the load genuinely needs server-only state (`locals`, cookies, secrets).

`+page.ts` runs universally: on the server for SSR, then in the browser on client-side navigation — no SvelteKit data round-trip on nav. Use it for data both sides can fetch.

**The two can coexist on the same route.** Put guards in `+page.server.ts`, fetch in `+page.ts`. SvelteKit merges the returned objects.

**Rule of thumb:**

- Auth-gated Convex data → `+page.ts` with `convexLoad`, paired with a `+page.server.ts` guard when the route is members-only.
- Public or derived data → `+page.ts` is fine on its own.
- Guard that depends on `locals` → always `+page.server.ts`.

### 13. Use hooks.server.ts for middleware (auth, redirects)

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

### 14. Use `$app/state` (not `$app/stores`) for reactive page / navigation state

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
- Changes to `page` are only reactive inside runes (`$derived(page.params.id)`). The legacy `$:` syntax will not re-run.
- `$app/stores` is deprecated and scheduled for removal in SvelteKit 3.
- Migration: `bun x sv@latest migrate app-state` auto-converts usages in `.svelte` files.

**Reference:** [`$app/state` reference](https://svelte.dev/docs/kit/$app-state)

### 15. Seed Convex data with `convexLoad` in `+page.ts`, guarded by `+page.server.ts`

This is the default shape for any SvelteKit route in this repo that reads auth-gated Convex data. `convexLoad` gives you an SSR-seeded first paint plus a live Convex subscription.

**Correct (guard in server load, data in universal load):**

```typescript
// +page.server.ts
import { redirect } from '@sveltejs/kit';
export const load = async ({ locals }) => {
  if (!locals.session) redirect(303, '/');
};
```

```typescript
// +page.ts
import { convexLoad } from '@mmailaender/convex-svelte/sveltekit';
import { api } from '$convex/_generated/api';

export const load = async () => {
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

**Prereq — three-piece setup in `src/hooks.ts`:**

All three pieces have to be right:

1. **Transport hook.** Without the encode/decode pair, `ConvexLoadResult` crosses the SSR boundary as a bare object, the client never upgrades to a live subscription.
2. **`{ expectAuth: true }` on `initConvex`.** Without it, queries fire before `setAuth` attaches the token and crash with `ConvexError: Unauthenticated`.
3. **Client pre-warm.** Without it, `convexLoad` in `+page.ts` deadlocks on cold page loads.

**Why the pre-warm is load-bearing:** On a cold load (new tab, refresh, Playwright `page.goto`), SvelteKit runs every universal load **before** mounting any component. `convexLoad` awaits `client.query(...)`, the socket is paused by `expectAuth: true`, and `setAuth(...)` happens in `+layout.svelte` at mount. Load awaits query → query awaits auth → auth awaits layout mount → layout mount awaits load. Deadlock. The pre-warm calls `setAuth(...)` at hooks-module load, before any load function runs.

```typescript
// src/hooks.ts
import { browser } from '$app/environment';
import { getConvexClient } from '@mmailaender/convex-svelte';
import {
  initConvex,
  encodeConvexLoad,
  decodeConvexLoad,
} from '@mmailaender/convex-svelte/sveltekit';
import type { Transport } from '@sveltejs/kit';
import type { AuthTokenFetcher } from 'convex/browser';
import { PUBLIC_CONVEX_URL } from '$env/static/public';
import { authClient } from '$lib/auth-client';

// 1. Seed the singleton. `expectAuth: true` pauses the websocket until
//    `setAuth(...)` attaches the Convex JWT.
initConvex(PUBLIC_CONVEX_URL, { expectAuth: true });

// 2. Client pre-warm — kicks the token fetch off at module load, *before*
//    any `+page.ts` / `+layout.ts` load runs.
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

// 3. Teach SvelteKit to encode/decode `ConvexLoadResult` across the SSR boundary.
export const transport: Transport = {
  ConvexLoadResult: { encode: encodeConvexLoad, decode: decodeConvexLoad },
};
```

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

**When to use `+page.server.ts` for Convex data instead:**

- The load needs `locals`, cookies, or secrets the universal load can't touch.
- You want to avoid the universal load re-running on SPA navigation (rare).

## Anti-Patterns

- Don't use `writable`, `readable`, `derived`, `get` from `svelte/store`
- Don't use `$:` for derivations or side effects
- Don't use `export let` for props
- Don't fetch in `onMount` when data is needed for SSR
- Don't create `+server.ts` API routes just for form POST handling
- Don't use `bind:value` with a prop unless the prop is `$bindable()`
- Don't `throw redirect(...)` / `throw error(...)` — in SvelteKit 2, calling them is sufficient
- Don't destructure `{ status, message }` from `$props()` in `+error.svelte` — use `page.error`
- Don't import from `$app/stores` in new code — use `$app/state` (requires runes)
- Don't default a snippet prop to `@render(...)` — `@render` is not a JS expression

## References

### Svelte 5

- [Runes overview](https://svelte.dev/docs/svelte/what-are-runes) — `$state`, `$derived`, `$effect`, `$props`, `$bindable`
- [`{#snippet ...}`](https://svelte.dev/docs/svelte/snippet) — snippet declaration, typing, optional props
- [`{@render ...}`](https://svelte.dev/docs/svelte/@render) — rendering snippets, optional chaining
- [v5 migration guide](https://svelte.dev/docs/svelte/v5-migration-guide)

### SvelteKit 2

- [Form actions](https://svelte.dev/docs/kit/form-actions) — `fail`, named actions, `use:enhance`
- [Load functions](https://svelte.dev/docs/kit/load) — `+page.ts` vs `+page.server.ts`, streaming, redirects
- [Errors](https://svelte.dev/docs/kit/errors) — `+error.svelte`, `page.error`, `handleRenderingErrors`
- [`$app/state`](https://svelte.dev/docs/kit/$app-state) — `page`, `navigating`, `updated`
- [`@sveltejs/kit` API](https://svelte.dev/docs/kit/@sveltejs-kit) — `redirect`, `error`, `fail`, `isRedirect`
- [Hooks](https://svelte.dev/docs/kit/hooks) — `handle`, `handleError`, `handleFetch`
- [SvelteKit 2 migration guide](https://svelte.dev/docs/kit/migrating-to-sveltekit-2) — includes [`redirect`/`error` no longer thrown](https://svelte.dev/docs/kit/migrating-to-sveltekit-2#redirect-and-error-are-no-longer-thrown-by-you) and [`$app/stores` deprecation](https://svelte.dev/docs/kit/migrating-to-sveltekit-2#SvelteKit-2.12:-$app/stores-deprecated)

### Superforms (used in this repo)

- [Superforms docs](https://superforms.rocks/)
- [Error handling — `setError`, `fail`](https://superforms.rocks/concepts/error-handling)
- [Status messages — `message()`](https://superforms.rocks/concepts/messages)
- [Flash messages (redirects with toasts)](https://superforms.rocks/flash-messages)

### Convex (used in this repo)

Auth-gated Convex data goes through `convexLoad` in `+page.ts`, with a thin `+page.server.ts` holding the guard — see rule 15 for the full shape, including the three-piece `src/hooks.ts` setup. `useQuery` inside `+page.svelte` is still fine for data that doesn't need SSR seeding.
