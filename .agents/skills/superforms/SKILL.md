---
name: superforms
description:
  How to build every form in the fleet repo with sveltekit-superforms + Formsnap + Zod. Covers the
  client-only (SPA) pattern that is the default for this app, the schema-sharing rule between Zod
  and Convex validators, UI wiring via shadcn-svelte's `form` component, auth flows that wrap
  better-auth's client SDK, redirects with toasts, and when to reach for action mode instead. Use
  whenever creating or modifying any form — login, signup, CRUD dialog, settings panel, filter UI.
metadata:
  tags: forms, superforms, formsnap, zod, convex, better-auth, svelte, sveltekit
---

## When to use

Use this skill whenever you are:

- Building a login, signup, password-reset, or email-verification form (better-auth flows)
- Building a CRUD dialog or page form for a Convex entity (create, edit, delete)
- Building a search/filter/settings form that collects user input before calling an API
- Wiring validation, error display, or form submission in any `.svelte` file
- Reviewing a PR that introduces new form UI

**Complementary skills (load them when relevant):**

- `project-structure` — where schema files, route components, and form components live
- `shadcn-svelte` — Formsnap is installed via `shadcn-svelte add form`; all form UI follows the
  shadcn primitives pattern
- `sveltekit-best-practices` — Svelte 5 runes, `$props`, `$state`, `{@render ...}`, `$app/state`
- `package-manager` — bun-only rules for the `bun add` steps in the one-time setup below

## Core principles

1. **One form library.** Every form in this app uses `sveltekit-superforms`. Never a bespoke
   `$state` + `<form onsubmit>` + manual validation. Never Felte, `@tanstack/svelte-form`, or
   hand-rolled Zod-plus-runes glue.
2. **One schema library.** Every form schema is Zod. No `@sinclair/typebox`, Valibot, ArkType, or
   hand-authored JSON Schema.
3. **One source of truth for shared shapes.** If a Zod schema also validates a Convex mutation,
   it lives in `src/convex/schemas/<entity>.ts` and is used by _both_ sides — never parallel
   Zod + `v.*` definitions for the same shape.
4. **Client-only (SPA) is the default.** Convex and better-auth are client-callable; most forms
   do not need a SvelteKit form action. Server actions are the exception, not the default.
5. **Formsnap/shadcn for UI.** Wire every field through `<Form.Field>`, `<Form.Control>`,
   `<Form.Label>`, `<Form.FieldErrors>`. Never hand-wire `for`/`id`/`aria-describedby`.
6. **TypeScript always.** Zero type errors. `bun run check` clean before a change is done.
7. **Prettier always.** `bun run format` after every form change.

## One-time setup (project stack)

These installs should happen **once**. If you're the first to write a form in this repo and any of
these are missing, add them. Otherwise, skip to the rules below.

```sh
bun add zod sveltekit-superforms convex-helpers sveltekit-flash-message
bun x shadcn-svelte@latest add form input label button -y -o
bun run format && bun run check
```

- `zod` — schema library (Zod 4; use `import { z } from 'zod'`).
- `sveltekit-superforms` — form state, validation, enhance, events.
- `convex-helpers` — provides `zCustomMutation` and `zodToConvex` for the shared-schema pattern.
- `sveltekit-flash-message` — for toasts that survive a `goto(...)` or action redirect.
- `shadcn-svelte add form` — installs the `$lib/components/ui/form/` primitives (which wrap
  Formsnap) and pulls in `formsnap` as a dependency.

**shadcn-svelte CLI gotchas** (learned the hard way, don't regress — see `shadcn-svelte` skill
rule 3 for the full story):

- Always pass **both** `-y` (skip config prompts) **and** `-o` (overwrite existing). `form`
  depends on `button` + `label`; if those already exist the CLI prompts "overwrite existing
  files?" and `-y` alone does not dismiss it — the command then looks frozen.
- **Never pipe or redirect the output** (`| tail`, `| cat`, `2>&1 | ...`, `> out.log`). The CLI
  detects a non-TTY stdout; its clack prompts still wait for input but the banner never flushes,
  making it look like a hang. Run it bare.
- If `button.svelte` already has local customizations (e.g. ESLint disable comments), back it up
  before running and restore afterwards — `-o` will overwrite it.

**Also create two shared files** if they do not exist yet — the whole skill assumes they are in
place:

- `src/lib/forms/create-form.ts` — the project's `superForm` wrapper with baked-in defaults
  (SPA, validators, adapter). Every component imports `createForm` from `$lib/forms`. See
  rule 3 below for the full contents.
- `src/convex/functions.ts` — the shared `zQuery` / `zMutation` / `zAction` builders. Every
  Convex endpoint imports from here. See rule 7 below for the full contents.

Do **not** configure anything else. No custom `hooks.client.ts` initializers for Superforms. No
global form config beyond `createForm`'s defaults.

## Critical Rules

### 1. Every form goes through Superforms + Formsnap + Zod

If you're binding a single `$state` variable to an `<input>` and writing `onsubmit={...}` —
**stop**. That's a form. It needs Superforms.

**Wrong (bespoke runes form — AI agents love generating this):**

```svelte
<script lang="ts">
  let email = $state('');
  let password = $state('');
  let error = $state<string | null>(null);

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!email.includes('@')) {
      error = 'Invalid email';
      return;
    }
    // ... call API, handle errors ...
  }
</script>

<form onsubmit={handleSubmit}>
  <input bind:value={email} />
  {#if error}<p>{error}</p>{/if}
  <button>Sign in</button>
</form>
```

This reinvents every single thing Superforms gives you: validation, error state, field-level
messages, loading/submitting state, taint tracking, accessibility, typed data.

**Correct:** see the Login pattern below in "Patterns".

### 2. Schema placement — shared Convex schemas live under `src/convex/schemas/`

| Schema kind                          | Location                                             | Imported from Convex | Imported from client       |
| ------------------------------------ | ---------------------------------------------------- | -------------------- | -------------------------- |
| Shared with a Convex mutation        | `src/convex/schemas/<entity>.ts`                     | `./schemas/<entity>` | `$convex/schemas/<entity>` |
| Client-only form (auth, UI, filters) | `$lib/schemas/<name>.ts` or route-local `schemas.ts` | —                    | `$lib/schemas/<name>`      |

**Why:** Convex functions run on Convex's server runtime, not Vite. They cannot resolve the `$lib`
alias. The `$convex` alias (configured in `svelte.config.js`) is the symmetric solution — client
code reads from `$convex/schemas/...`, Convex reads from the same folder via a relative path.

**Correct (shared Convex entity schema):**

```typescript
// src/convex/schemas/car.ts
import { z } from 'zod';

export const carCreateSchema = z.object({
  make: z.string().min(1, 'Make is required').max(60),
  model: z.string().min(1, 'Model is required').max(60),
  year: z.number().int().min(1900).max(2100),
  priceCents: z.number().int().nonnegative(),
});

export type CarCreate = z.infer<typeof carCreateSchema>;

export const carUpdateSchema = carCreateSchema.partial().extend({
  id: z.string(),
});

export type CarUpdate = z.infer<typeof carUpdateSchema>;
```

```typescript
// src/convex/cars.ts — uses the same schema as the client, and the shared zMutation
import { query } from './_generated/server';
import { zMutation } from './functions';
import { carCreateSchema } from './schemas/car';

export const list = query({
  args: {},
  handler: async (ctx) => ctx.db.query('cars').collect(),
});

export const create = zMutation({
  args: carCreateSchema.shape,
  handler: async (ctx, args) => {
    return await ctx.db.insert('cars', { ...args, createdAt: Date.now() });
  },
});
```

```svelte
<!-- src/routes/cars/new/+page.svelte — same schema, client-side -->
<script lang="ts">
  import { createForm } from '$lib/forms';
  import { carCreateSchema } from '$convex/schemas/car';
  // const form = createForm({ schema: carCreateSchema, onUpdate });
</script>
```

**Wrong (parallel definitions, guaranteed to drift):**

```typescript
// src/convex/cars.ts
import { v } from 'convex/values';
export const create = mutation({
  args: { make: v.string(), model: v.string(), year: v.number(), priceCents: v.number() },
  handler: async (ctx, args) => {
    /* ... */
  },
});

// $lib/schemas/car.ts
import { z } from 'zod';
export const carCreateSchema = z.object({
  make: z.string(),
  model: z.string(),
  year: z.number(),
  priceCents: z.number(),
});
```

Two sources of truth, no validation sharing, drift guaranteed.

**Client-only schema exception (auth, UI state, etc.):**

```typescript
// $lib/schemas/login.ts — not a Convex entity; lives in $lib
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().default(true),
});

export type Login = z.infer<typeof loginSchema>;
```

### 3. Use `createForm` — the project wrapper — and pick a seeding strategy

**Never call `superForm` directly in a component.** Use `createForm` from `$lib/forms`. It hides
the `zod4` / `zod4Client` adapter split, bakes in the app's defaults (`SPA: true`,
`resetForm: false`, client validators), and keeps every form in the repo identical on the config
side so diffs are only about _this_ form's fields and submit behavior.

#### The wrapper itself (`src/lib/forms/create-form.ts`)

Create this file once — every form in the repo depends on it.

```typescript
// src/lib/forms/create-form.ts
import {
  defaults,
  superForm,
  type FormOptions,
  type Infer,
  type InferIn,
  type SuperValidated,
} from 'sveltekit-superforms';
import { zod4, zod4Client } from 'sveltekit-superforms/adapters';
import type { z } from 'zod';

// Must be an object schema — superforms' adapters require `Record<string, unknown>` output.
type ObjectSchema = z.ZodType<Record<string, unknown>>;

type CreateFormInput<S extends ObjectSchema> = {
  /** Zod schema — used for both `defaults()` and client validators. */
  schema: S;
  /**
   * Optional pre-validated seed from a `+page.ts` / `+page.server.ts` load.
   * When omitted, the form starts from `defaults(zod4(schema))`.
   *
   * Note: the second/third type args use the `'zod4'` tag so the types
   * unify with `defaults(zod4(schema))`. Using plain `Infer<S>` here
   * produces "Type instantiation is excessively deep" errors.
   */
  data?: SuperValidated<Infer<S, 'zod4'>, unknown, InferIn<S, 'zod4'>>;
} & Partial<FormOptions<Infer<S, 'zod4'>>>;

/**
 * Thin wrapper around `superForm` that binds the Zod schema once for both
 * the initial value and the client-side validators. Any `FormOptions` key
 * (including `SPA`, `resetForm`, `onUpdate`, …) can be overridden per-call.
 * Defaults lean toward the common case: SPA mode + keep form on success.
 * Opt out of SPA with `SPA: undefined` (superforms' native "use the form
 * action" signal).
 */
export function createForm<S extends ObjectSchema>({
  schema,
  data,
  ...overrides
}: CreateFormInput<S>) {
  return superForm(data ?? defaults(zod4(schema)), {
    SPA: true,
    resetForm: false,
    validators: zod4Client(schema),
    ...overrides,
  });
}
```

Plus a tiny re-export so consumers import from a stable path:

```typescript
// src/lib/forms/index.ts
export { createForm } from './create-form';
```

Consumers always import from the folder, not the file:

```typescript
import { createForm } from '$lib/forms';
```

(The no-barrel rule in `project-structure` 3b is about `components/`, `ui/`, `app/` — it does
not apply to utility folders like `forms/`.)

#### Seeding strategy: `SPA: true` controls submission, not rendering

A common misconception: "`SPA: true` means no SSR." Wrong. `SPA: true` only disables the
POST-to-action on submit. The form HTML still renders server-side with whatever initial values
`createForm` passes to `superForm`. You pick how those initial values are produced based on the
kind of form.

| Form shape                               | `createForm` call                                   | Load file needed  |
| ---------------------------------------- | --------------------------------------------------- | ----------------- |
| Create / login / empty start             | `createForm({ schema, onUpdate })`                  | None              |
| Edit, prefill from a public Convex query | `createForm({ schema, data: data.form, onUpdate })` | `+page.ts`        |
| Edit, prefill with auth-only data        | `createForm({ schema, data: data.form, onUpdate })` | `+page.server.ts` |
| Progressive enhancement / OAuth          | rule 4 (drop `SPA: true`)                           | `+page.server.ts` |

#### 3a. Empty / create form — no load needed

```svelte
<script lang="ts">
  import { createForm } from '$lib/forms';
  import { carCreateSchema } from '$convex/schemas/car';

  const form = createForm({
    schema: carCreateSchema,
    onUpdate: async ({ form }) => {
      if (!form.valid) return;
      // convex.mutation(api.cars.create, form.data)
    },
  });
</script>
```

Use for: login, signup, "new car", "new task", search/filter.

#### 3b. Prefilled form with public data — `+page.ts` + `superValidate`

`+page.ts` runs on both server and client. On SSR, it produces the initial HTML; on navigation,
it runs again in the browser. No server hop at submit time.

```ts
// src/routes/cars/[id]/edit/+page.ts
import { error } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { ConvexHttpClient } from 'convex/browser';
import { PUBLIC_CONVEX_URL } from '$env/static/public';
import { api } from '$convex/_generated/api';
import { carUpdateSchema } from '$convex/schemas/car';

export const load = async ({ params }) => {
  const convex = new ConvexHttpClient(PUBLIC_CONVEX_URL);
  const car = await convex.query(api.cars.get, { id: params.id });
  if (!car) error(404, 'Car not found');

  const form = await superValidate(car, zod4(carUpdateSchema));
  return { form, carId: car._id };
};
```

```svelte
<!-- src/routes/cars/[id]/edit/+page.svelte -->
<script lang="ts">
  import { createForm } from '$lib/forms';
  import { carUpdateSchema } from '$convex/schemas/car';

  let { data } = $props();

  const form = createForm({
    schema: carUpdateSchema,
    data: data.form,
    onUpdate: async ({ form }) => {
      if (!form.valid) return;
      // convex.mutation(api.cars.update, form.data)
    },
  });
</script>
```

The initial HTML ships with the existing car's values already in the inputs (great for SEO and
perceived performance); submit still goes client-side to Convex.

Note: `superValidate` is the one Superforms API we still call directly — only in `load`
functions. It is not worth wrapping: the `zod4(schema)` call there is one symbol, and the
overloads (`superValidate(schema)`, `superValidate(data, schema)`,
`superValidate(request, schema)`) would be awkward to wrap cleanly.

#### 3c. Prefilled form with auth-only / server-only data — `+page.server.ts`

Swap the load file to `+page.server.ts` when:

- The query requires the user's better-auth session / Convex auth token (you do not want to
  forward cookies to `PUBLIC_CONVEX_URL` from the browser-side `+page.ts`)
- The load touches a secret, a Node-only module, or `$env/static/private`
- You want SvelteKit to transfer `data.form` from server to client without re-running the load
  in the browser

The component's `createForm` call is **identical** to 3b — you still pass
`createForm({ schema, data: data.form, onUpdate })`. Only the load file changes. See rule 4 for
the rare case where even submission must go through a form action.

#### Overriding the defaults

Any default can be turned off per-form by passing the option explicitly:

```typescript
createForm({
  schema: mySchema,
  SPA: undefined, // opt out of SPA mode (rule 4) — superforms' native signal for "submit to the form action"
  resetForm: true, // clear on successful submit
  validationMethod: 'onblur',
  onUpdate: ({ form }) => {
    /* ... */
  },
});
```

All options accepted by `superForm` pass through via `...overrides`. Because `superForm`'s
`SPA` type is `string | true | object | undefined` — there is no `false` — you signal "use
the form action" by overriding the default back to `undefined`.

**Do not use `onSubmit` for the API call in SPA mode.** `onSubmit` fires _before_ validation.
Always call Convex / better-auth / APIs from `onUpdate`, which runs after validation passes.

### 4. Action mode only when you genuinely need progressive enhancement

Use SvelteKit form actions **only** when:

- The form must work without JavaScript (rare; this app is not SSG-for-non-JS).
- You're handling a webhook callback, OAuth redirect, or other true-POST endpoint.
- A third-party service posts to your app and expects a 302 redirect.

**For every other form (login, signup, CRUD, settings, search) — use SPA mode.** A form action
that just calls a Convex mutation via HTTP is an unnecessary hop: extra latency, no optimistic
updates, and you lose the reactivity of `useQuery`.

**If you do need an action:**

```typescript
// src/routes/<path>/+page.server.ts
import { superValidate, fail } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { someSchema } from '$convex/schemas/something';
import { redirect } from '@sveltejs/kit';

export const load = async () => ({
  form: await superValidate(zod4(someSchema)),
});

export const actions = {
  default: async ({ request, locals }) => {
    const form = await superValidate(request, zod4(someSchema));
    if (!form.valid) return fail(400, { form });
    // ... call Convex HTTP client or similar ...
    redirect(303, '/done'); // no `throw` in SvelteKit 2
  },
};
```

In the component, reuse `createForm` and override `SPA: undefined`:

```svelte
<script lang="ts">
  import { createForm } from '$lib/forms';
  import { someSchema } from '$convex/schemas/something';

  let { data } = $props();

  const form = createForm({
    schema: someSchema,
    data: data.form,
    SPA: undefined,
  });
</script>
```

The wrapper still handles `validators: zod4Client(someSchema)` and the rest — the only change
from an SPA form is the `SPA: undefined` override and the absence of `onUpdate` (the action
handles submission now).

### 5. UI via shadcn-svelte's `form` component (wraps Formsnap)

Never hand-write `<label for>` / `<input id>` / `<aria-describedby>`. Use the Formsnap primitives
re-exported by shadcn:

```svelte
<form method="POST" use:enhance>
  <Form.Field {form} name="email">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>Email</Form.Label>
        <Input type="email" {...props} bind:value={$formData.email} />
      {/snippet}
    </Form.Control>
    <Form.Description>We'll never share it.</Form.Description>
    <Form.FieldErrors />
  </Form.Field>
</form>
```

**Anatomy (always this shape):**

- `<Form.Field {form} name="...">` — scopes state for one field; the `name` **must** match a
  top-level key in the schema.
- `<Form.Control>` with `{#snippet children({ props })}` — the Svelte 5 way to get the generated
  `id`, `name`, `aria-*`, `data-fs-error` attrs onto the actual input.
- `<Form.Label>` — automatically gets `for={field.id}`.
- **Any input** — `<Input>`, `<Textarea>`, `<Select>`, a shadcn `<Checkbox>`, etc. Spread
  `{...props}` onto it and `bind:value={$formData.<field>}`.
- `<Form.Description>` — optional helper text. Auto-wired to `aria-describedby`.
- `<Form.FieldErrors />` — renders the Zod validation messages for this field.

**Why the `{#snippet children({ props })}`:** in Svelte 5, `<Form.Control>` can't render its
children with implicit context. The snippet destructures the field's generated attributes (`props`)
so you can spread them onto your input. This is shadcn-svelte's required shape; don't simplify.

For form-level errors (status messages, API failures not tied to a field), use `{$message}`:

```svelte
{#if $message}
  <Alert variant="destructive">{$message}</Alert>
{/if}
```

Display with `setMessage(form, 'text')` from `onUpdate`.

### 6. Auth flows wrap better-auth's client SDK inside Superforms

Never call `authClient.signIn.email(...)` directly from a component's `onclick`. Always wrap it in
a Superforms `onUpdate`. Superforms provides the validation, error plumbing, loading state, and
accessibility you need; better-auth provides the actual auth call.

```svelte
onUpdate: async ({ form }) => {
  if (!form.valid) return;

  const { error } = await authClient.signIn.email({
    email: form.data.email,
    password: form.data.password,
    rememberMe: form.data.rememberMe,
  });

  if (error) {
    // better-auth returns a typed error with .message, .code, .status
    if (error.code === 'INVALID_EMAIL_OR_PASSWORD') {
      setError(form, 'password', 'Invalid email or password');
    } else {
      setError(form, '', error.message ?? 'Sign-in failed');
    }
    return;
  }

  await goto(resolve('/dashboard'));
},
```

**Never do this:**

```svelte
<!-- Raw better-auth SDK call, no validation, no loading state, no typed errors -->
<button
  onclick={async () => {
    await authClient.signIn.email({ email, password });
  }}
>
  Sign in
</button>
```

### 7. Define `zQuery` / `zMutation` / `zAction` once in `src/convex/functions.ts`

`convex-helpers` exports builder factories (`zCustomQuery`, `zCustomMutation`, `zCustomAction`)
that wrap Convex's raw `query` / `mutation` / `action` to accept Zod validators as args. Under
the hood they translate Zod to Convex validators via `zodToConvex` and run the Zod validator for
tighter refinements (`z.email()`, `z.string().min(1)`, `z.coerce.number()`, etc.).

**Create the builders once** and import them from every endpoint file. **Do not** redeclare
`const zMutation = zCustomMutation(mutation, NoOp)` in every file.

**`src/convex/functions.ts`:**

```typescript
import { NoOp } from 'convex-helpers/server/customFunctions';
import { zCustomQuery, zCustomMutation, zCustomAction } from 'convex-helpers/server/zod4';
import { query, mutation, action } from './_generated/server';

export const zQuery = zCustomQuery(query, NoOp);
export const zMutation = zCustomMutation(mutation, NoOp);
export const zAction = zCustomAction(action, NoOp);
```

Add `zInternalQuery` / `zInternalMutation` / `zInternalAction` in the same file when you need
non-public helpers (wrapping `internalQuery`/`internalMutation`/`internalAction`).

**Endpoint files import the shared builder:**

```typescript
// src/convex/cars.ts
import type { Id } from './_generated/dataModel';
import { zid } from 'convex-helpers/server/zod4';
import { zMutation, zQuery } from './functions';
import { carCreateSchema, carUpdateSchema } from './schemas/car';

export const get = zQuery({
  args: { id: zid('cars') },
  handler: async (ctx, { id }) => ctx.db.get(id),
});

export const create = zMutation({
  args: carCreateSchema.shape,
  handler: async (ctx, args) => ctx.db.insert('cars', { ...args, createdAt: Date.now() }),
});

export const update = zMutation({
  args: carUpdateSchema.shape,
  handler: async (ctx, { id, ...rest }) => {
    await ctx.db.patch(id as Id<'cars'>, rest);
  },
});
```

`zid('cars')` produces a table-aware `v.id('cars')` under the hood (see the Stack article's `zid`
section).

**Why:** The builders are identity-preserving — there is no reason for each file to create its
own. One file means one place to add cross-cutting behavior (auth-aware `customCtx`, rate
limits, logging) without touching every endpoint. It also matches the
[convex-helpers Zod pattern](https://stack.convex.dev/typescript-zod-function-validation) ("Make
this once, to use anywhere you would have used `query`").

**Safety:** `functions.ts` exports factories, not Convex endpoints. Convex's function indexer
only picks up modules that call `query()` / `mutation()` / `action()` at the top level, so this
file shows up as a plain helper module — no ghost endpoints in the dashboard.

**Client calls the mutation from the form's `onUpdate`:**

```svelte
<script lang="ts">
  import { setError } from 'sveltekit-superforms';
  import { createForm } from '$lib/forms';
  import { useConvexClient } from '@mmailaender/convex-svelte';
  import { api } from '$convex/_generated/api';
  import { carCreateSchema } from '$convex/schemas/car';

  const convex = useConvexClient();

  const form = createForm({
    schema: carCreateSchema,
    onUpdate: async ({ form }) => {
      if (!form.valid) return;
      try {
        await convex.mutation(api.cars.create, form.data);
        await goto(resolve('/cars'));
      } catch (err) {
        setError(form, '', err instanceof Error ? err.message : 'Failed to create car');
      }
    },
  });
</script>
```

### 8. Redirects: `goto(resolve(...))` in SPA mode; `sveltekit-flash-message` for toasts

Two situations:

**A. Successful submit → navigate to another route.**

In SPA mode you are in client code, so redirect with `goto` from `$app/navigation` and `resolve`
from `$app/paths`:

```typescript
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

// inside onUpdate after success
await goto(resolve('/dashboard'));
```

**B. Redirect with a toast message (e.g., "Account created. Please check your email").**

Use `sveltekit-flash-message`. It persists a message across the navigation boundary.

```typescript
import { setFlash } from 'sveltekit-flash-message/client';
import { page } from '$app/state';

// inside onUpdate after success
setFlash({ type: 'success', message: 'Car created' }, page);
await goto(resolve('/cars'));
```

Then in `+layout.svelte`, render flash messages via `getFlash(page)` and a `Toaster`.

Do **not** show a toast _and_ navigate in the same tick without flash-message — the destination
page re-renders and the toast is lost.

### 9. TypeScript, format, check — every time

After creating or modifying a form:

```sh
bun run format
bun run check
```

Both must be clean before the form is considered done. No `any`, no `@ts-ignore`, no
`@ts-expect-error` in form code.

For the `data` prop in SSR-seeded or action-mode components, type it through
`SuperValidated<Infer<Schema>>`:

```svelte
<script lang="ts">
  import type { SuperValidated, Infer } from 'sveltekit-superforms';
  import type { carUpdateSchema } from '$convex/schemas/car';

  let { data }: { data: { form: SuperValidated<Infer<typeof carUpdateSchema>> } } = $props();
</script>
```

For empty / create forms (seeding strategy 3a), there is no `data.form` — `createForm` infers
the shape from the `schema` argument directly, so `$formData` is fully typed with no extra work.
If inference ever breaks, annotate on the call site with the schema's inferred type.

## Decision flowchart

```
Need a form?                    (every path uses `createForm` from $lib/forms)
│
├─ Is it a Convex-entity form (create / update / delete a row)?
│   └─ Schema: src/convex/schemas/<entity>.ts (shared with Convex)
│      Submit: default SPA mode → convex.mutation(api.<entity>.<fn>, form.data) in onUpdate
│      Seed:
│        • empty / create  → createForm({ schema, onUpdate })                       (rule 3a)
│        • prefilled edit  → +page.ts loads row via superValidate(row, zod4(...))   (rule 3b)
│                            createForm({ schema, data: data.form, onUpdate })
│        • auth-gated edit → +page.server.ts loads row via superValidate            (rule 3c)
│                            createForm({ schema, data: data.form, onUpdate })
│      File: src/routes/<entity>/<path>/components/<kebab-name>/<kebab-name>.svelte
│
├─ Is it an auth form (sign in / sign up / reset / verify)?
│   └─ Schema: $lib/schemas/<name>.ts (client-only; not a Convex entity)
│      Submit: default SPA mode → authClient.<method>(form.data) in onUpdate
│      Seed: createForm({ schema, onUpdate }) (rule 3a)
│      File: src/routes/(auth)/<name>/components/<kebab-name>/<kebab-name>.svelte
│
├─ Is it a UI-only form (filter, search, settings orchestrating multiple mutations)?
│   └─ Schema: route-local schemas.ts or $lib/schemas/<name>.ts
│      Submit: default SPA mode → orchestration in onUpdate
│      Seed: createForm({ schema, onUpdate }), or pass data.form if a load seeds values
│
└─ Does the form legitimately need progressive enhancement
   (no-JS support, OAuth callback, webhook)?
    └─ Mode: action — rule 4. Still use createForm, but override SPA: undefined.
       Route flow: +page.server.ts load returns { form } via superValidate;
                   actions.default validates + acts + redirects.
```

## Patterns

### A. Login (better-auth + Superforms SPA)

**Files:**

```
src/routes/(auth)/login/
  +page.svelte
  components/
    login-form/
      login-form.svelte
      index.ts
$lib/schemas/login.ts
```

```typescript
// $lib/schemas/login.ts
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.email({ message: 'Enter a valid email' }),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().default(true),
});

export type Login = z.infer<typeof loginSchema>;
```

```svelte
<!-- src/routes/(auth)/login/components/login-form/login-form.svelte -->
<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { setError } from 'sveltekit-superforms';
  import { createForm } from '$lib/forms';
  import { loginSchema } from '$lib/schemas/login';
  import { authClient } from '$lib/auth-client';
  import * as Form from '$lib/components/ui/form';
  import { Input } from '$lib/components/ui/input';
  import { Button } from '$lib/components/ui/button';
  import { Checkbox } from '$lib/components/ui/checkbox';

  const form = createForm({
    schema: loginSchema,
    onUpdate: async ({ form }) => {
      if (!form.valid) return;

      const { error } = await authClient.signIn.email({
        email: form.data.email,
        password: form.data.password,
        rememberMe: form.data.rememberMe,
      });

      if (error) {
        if (error.code === 'INVALID_EMAIL_OR_PASSWORD') {
          setError(form, 'password', 'Invalid email or password');
        } else {
          setError(form, '', error.message ?? 'Sign-in failed');
        }
        return;
      }

      await goto(resolve('/dashboard'));
    },
  });

  const { form: formData, enhance, submitting, message } = form;
</script>

<form method="POST" use:enhance class="flex w-full max-w-sm flex-col gap-4">
  {#if $message}
    <p class="text-sm text-destructive" role="alert">{$message}</p>
  {/if}

  <Form.Field {form} name="email">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>Email</Form.Label>
        <Input type="email" autocomplete="email" {...props} bind:value={$formData.email} />
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>

  <Form.Field {form} name="password">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>Password</Form.Label>
        <Input
          type="password"
          autocomplete="current-password"
          {...props}
          bind:value={$formData.password}
        />
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>

  <Form.Field {form} name="rememberMe">
    <Form.Control>
      {#snippet children({ props })}
        <div class="flex items-center gap-2">
          <Checkbox {...props} bind:checked={$formData.rememberMe} />
          <Form.Label>Remember me</Form.Label>
        </div>
      {/snippet}
    </Form.Control>
  </Form.Field>

  <Button type="submit" disabled={$submitting}>
    {$submitting ? 'Signing in…' : 'Sign in'}
  </Button>
</form>
```

```typescript
// src/routes/(auth)/login/components/login-form/index.ts
export { default as LoginForm } from './login-form.svelte';
```

```svelte
<!-- src/routes/(auth)/login/+page.svelte -->
<script lang="ts">
  import { LoginForm } from './components/login-form';
</script>

<div class="container mx-auto flex min-h-screen items-center justify-center">
  <LoginForm />
</div>
```

### B. Car create (Convex mutation + Superforms SPA)

**Files:**

```
src/convex/schemas/car.ts
src/convex/cars.ts
src/routes/cars/new/
  +page.svelte
  components/
    car-create-form/
      car-create-form.svelte
      index.ts
```

```typescript
// src/convex/schemas/car.ts
import { z } from 'zod';

export const carCreateSchema = z.object({
  make: z.string().min(1, 'Make is required').max(60),
  model: z.string().min(1, 'Model is required').max(60),
  year: z.coerce.number().int().min(1900).max(2100),
  priceCents: z.coerce.number().int().nonnegative(),
});

export type CarCreate = z.infer<typeof carCreateSchema>;
```

```typescript
// src/convex/cars.ts
import { query } from './_generated/server';
import { zMutation } from './functions';
import { carCreateSchema } from './schemas/car';

export const list = query({
  args: {},
  handler: async (ctx) => ctx.db.query('cars').collect(),
});

export const create = zMutation({
  args: carCreateSchema.shape,
  handler: async (ctx, args) => {
    return await ctx.db.insert('cars', { ...args, createdAt: Date.now() });
  },
});
```

```svelte
<!-- src/routes/cars/new/components/car-create-form/car-create-form.svelte -->
<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { setFlash } from 'sveltekit-flash-message/client';
  import { page } from '$app/state';
  import { setError } from 'sveltekit-superforms';
  import { createForm } from '$lib/forms';
  import { useConvexClient } from '@mmailaender/convex-svelte';
  import { api } from '$convex/_generated/api';
  import { carCreateSchema } from '$convex/schemas/car';
  import * as Form from '$lib/components/ui/form';
  import { Input } from '$lib/components/ui/input';
  import { Button } from '$lib/components/ui/button';

  const convex = useConvexClient();

  const form = createForm({
    schema: carCreateSchema,
    onUpdate: async ({ form }) => {
      if (!form.valid) return;
      try {
        await convex.mutation(api.cars.create, form.data);
        setFlash({ type: 'success', message: 'Car created' }, page);
        await goto(resolve('/cars'));
      } catch (err) {
        setError(form, '', err instanceof Error ? err.message : 'Failed to create car');
      }
    },
  });

  const { form: formData, enhance, submitting, message } = form;
</script>

<form method="POST" use:enhance class="flex w-full max-w-lg flex-col gap-4">
  {#if $message}
    <p class="text-sm text-destructive" role="alert">{$message}</p>
  {/if}

  <div class="grid grid-cols-2 gap-4">
    <Form.Field {form} name="make">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label>Make</Form.Label>
          <Input {...props} bind:value={$formData.make} />
        {/snippet}
      </Form.Control>
      <Form.FieldErrors />
    </Form.Field>

    <Form.Field {form} name="model">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label>Model</Form.Label>
          <Input {...props} bind:value={$formData.model} />
        {/snippet}
      </Form.Control>
      <Form.FieldErrors />
    </Form.Field>

    <Form.Field {form} name="year">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label>Year</Form.Label>
          <Input type="number" {...props} bind:value={$formData.year} />
        {/snippet}
      </Form.Control>
      <Form.FieldErrors />
    </Form.Field>

    <Form.Field {form} name="priceCents">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label>Price (cents)</Form.Label>
          <Input type="number" {...props} bind:value={$formData.priceCents} />
        {/snippet}
      </Form.Control>
      <Form.FieldErrors />
    </Form.Field>
  </div>

  <Button type="submit" disabled={$submitting}>
    {$submitting ? 'Saving…' : 'Create car'}
  </Button>
</form>
```

### C. Car edit (SSR-seeded from Convex, submit client-side to Convex)

The canonical pattern for edit forms: `+page.ts` loads the existing record from Convex and runs
it through `superValidate`, the component reads `data.form`, and submission still goes through
`SPA: true` → `convex.mutation(...)`. The form HTML ships from the server already filled in.

**Files:**

```
src/convex/cars.ts                                       # list, get, create, update via zMutation/zQuery
src/convex/schemas/car.ts                                # carCreateSchema, carUpdateSchema
src/routes/cars/[id]/edit/
  +page.ts                                               # load: fetch car + superValidate
  +page.svelte                                           # passes data.form into createForm
  components/
    car-edit-form/
      car-edit-form.svelte
      index.ts
```

```typescript
// src/routes/cars/[id]/edit/+page.ts
import { error } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { ConvexHttpClient } from 'convex/browser';
import { PUBLIC_CONVEX_URL } from '$env/static/public';
import { api } from '$convex/_generated/api';
import { carUpdateSchema } from '$convex/schemas/car';

export const load = async ({ params }) => {
  const convex = new ConvexHttpClient(PUBLIC_CONVEX_URL);
  const car = await convex.query(api.cars.get, { id: params.id });
  if (!car) error(404, 'Car not found');

  const form = await superValidate(car, zod4(carUpdateSchema));
  return { form, carId: car._id };
};
```

```svelte
<!-- src/routes/cars/[id]/edit/+page.svelte -->
<script lang="ts">
  import { CarEditForm } from './components/car-edit-form';

  let { data } = $props();
</script>

<CarEditForm form={data.form} carId={data.carId} />
```

```svelte
<!-- src/routes/cars/[id]/edit/components/car-edit-form/car-edit-form.svelte -->
<script lang="ts">
  import type { SuperValidated, Infer } from 'sveltekit-superforms';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { setFlash } from 'sveltekit-flash-message/client';
  import { setError } from 'sveltekit-superforms';
  import { createForm } from '$lib/forms';
  import { useConvexClient } from '@mmailaender/convex-svelte';
  import { api } from '$convex/_generated/api';
  import { carUpdateSchema } from '$convex/schemas/car';
  import * as Form from '$lib/components/ui/form';
  import { Input } from '$lib/components/ui/input';
  import { Button } from '$lib/components/ui/button';

  let {
    form: initial,
    carId,
  }: {
    form: SuperValidated<Infer<typeof carUpdateSchema>>;
    carId: string;
  } = $props();

  const convex = useConvexClient();

  const form = createForm({
    schema: carUpdateSchema,
    data: initial,
    onUpdate: async ({ form }) => {
      if (!form.valid) return;
      try {
        await convex.mutation(api.cars.update, form.data);
        setFlash({ type: 'success', message: 'Car updated' }, page);
        await goto(resolve(`/cars/${carId}`));
      } catch (err) {
        setError(form, '', err instanceof Error ? err.message : 'Failed to update');
      }
    },
  });

  const { form: formData, enhance, submitting, message, tainted } = form;
</script>

<form method="POST" use:enhance class="flex w-full max-w-lg flex-col gap-4">
  {#if $message}
    <p class="text-sm text-destructive" role="alert">{$message}</p>
  {/if}

  <Form.Field {form} name="make">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>Make</Form.Label>
        <Input {...props} bind:value={$formData.make} />
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>

  <Form.Field {form} name="model">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>Model</Form.Label>
        <Input {...props} bind:value={$formData.model} />
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>

  <Button type="submit" disabled={$submitting || !$tainted}>
    {$submitting ? 'Saving…' : 'Save changes'}
  </Button>
</form>
```

**Notes:**

- No `+page.server.ts` is needed as long as the Convex query is public. Swap to
  `+page.server.ts` when the load needs auth cookies or a secret (see rule 3c).
- `$tainted` is Superforms' dirty-state store — disabling Save until the user changes something
  prevents accidental no-op mutations.
- On submit we call `convex.mutation(api.cars.update, form.data)` directly — there is no form
  action to POST to, matching `SPA: true`.
- `superValidate(car, zod4(carUpdateSchema))` validates the seed against the schema. If the
  stored row has drifted from the schema (e.g., a legacy field shape), you'll see errors on the
  initial render — much better than `defaults(car, ...)`, which skips validation entirely.

### D. Delete confirmation (simplest case)

A one-field form is still a form — use Superforms for the loading state, error plumbing, and
Formsnap's accessibility.

```svelte
<script lang="ts">
  import { z } from 'zod';
  import { setError } from 'sveltekit-superforms';
  import { createForm } from '$lib/forms';

  const confirmSchema = z.object({
    confirm: z.literal(true, { errorMap: () => ({ message: 'You must confirm' }) }),
  });

  const form = createForm({
    schema: confirmSchema,
    onUpdate: async ({ form }) => {
      if (!form.valid) return;
      try {
        await convex.mutation(api.cars.remove, { id: car.id });
        setFlash({ type: 'success', message: 'Car deleted' }, page);
        await goto(resolve('/cars'));
      } catch (err) {
        setError(form, '', err instanceof Error ? err.message : 'Failed to delete');
      }
    },
  });
</script>
```

## Anti-Patterns

- **Calling `superForm(...)` directly in a component.** Use `createForm` from `$lib/forms`. The
  wrapper exists so every form shares one config surface — if you override everything manually,
  project-wide defaults drift and diffs become about the wrong things.
- **Importing `zod4` or `zod4Client` in a `.svelte` file.** Those adapters live inside
  `createForm` and nowhere else on the client. `superValidate(data, zod4(schema))` in a `load`
  file is the only remaining caller.
- **Bespoke `$state` + `onsubmit` forms.** If it's a form, Superforms handles it. No exceptions.
- **Parallel Zod + Convex `v.*` definitions for the same shape.** One source of truth via
  `src/convex/schemas/` and `zCustomMutation`.
- **Client-only schemas in `src/convex/schemas/`.** If Convex doesn't import it, it lives in
  `$lib/schemas/` or route-local.
- **Redeclaring `const zMutation = zCustomMutation(mutation, NoOp)` in every endpoint file.**
  Create the builders once in `src/convex/functions.ts` and import from there (rule 7).
- **Assuming `SPA: true` disables SSR.** It only disables the POST-to-action on submit. Use
  `+page.ts` / `+page.server.ts` + `superValidate` to render the form with server-seeded initial
  values (rule 3b / 3c).
- **Using `defaults(car, zod4(schema))` for edit forms when you already have the data server-side.**
  `defaults()` skips validation; `superValidate(car, zod4(schema))` in a load function validates
  the seed and gives you SSR HTML that already contains the values.
- **Reaching for a form action just to call `convex.mutation(...)` on the server.** Unnecessary
  server hop; use SPA mode.
- **Calling `authClient.*` or `convex.mutation(...)` from a component's `onclick` without
  Superforms.** Wrap in `onUpdate`.
- **`onSubmit` for the API call in SPA mode.** `onSubmit` fires _before_ validation. Use
  `onUpdate`.
- **Hand-wiring `<label for>` / `<input id>` / `<aria-describedby>`.** Use Formsnap primitives
  via `$lib/components/ui/form`.
- **`use:enhance` without Superforms.** If you're reaching for `use:enhance` directly, you're
  reimplementing Superforms.
- **Returning the form mutation result from `onUpdate`.** `onUpdate` mutates `form` via
  `setError` / `setMessage`; return value is ignored.
- **Catching mutation errors silently.** Every `catch` must call `setError(form, '', ...)` so the
  user sees what happened.
- **Skipping `bun run format` / `bun run check` after a form change.**
- **Importing `$lib/schemas/<entity>` into Convex.** Convex can't resolve `$lib`. Schemas used by
  Convex live in `src/convex/schemas/`.
- **Using `validators: zod4(schema)` instead of `validators: zod4Client(schema)` on the client.**
  The client adapter is leaner (no server-only code pulled in); use it.
- **Toast-and-navigate in the same tick without flash-message.** The toast disappears with the
  page. Use `setFlash(...)` before `goto(...)`.
- **Leaving `$formData.field` as `any` by forgetting the schema.** `createForm({ schema })` infers
  the shape from the schema argument; if inference ever breaks, annotate the call site with
  `Infer<typeof schema>`.
- **Committing `src/convex/_generated/` edits by hand.** Regenerate via `npx convex dev`.

## References

- [sveltekit-superforms home](https://superforms.rocks/) — concepts, API, examples.
- [Superforms: SPA mode](https://superforms.rocks/concepts/spa) — the default pattern for this
  app.
- [Superforms: Events (`onSubmit`, `onUpdate`, `onUpdated`, `onError`)](https://superforms.rocks/concepts/events).
- [Superforms: Validators](https://superforms.rocks/concepts/validators) — `validators` option,
  `validationMethod`, partial validation.
- [Superforms: Default values](https://superforms.rocks/default-values) — `defaults()` helper.
- [Superforms: Error handling](https://superforms.rocks/concepts/error-handling) — `setError`,
  form-level errors, `$message`.
- [Superforms: Tainted fields](https://superforms.rocks/concepts/tainted) — dirty-state tracking.
- [Formsnap docs](https://formsnap.dev/) — the primitives shadcn wraps (`Field`, `Control`,
  `Label`, `FieldErrors`, `Description`).
- [shadcn-svelte: Form component](https://www.shadcn-svelte.com/docs/components/form) — the
  install + anatomy this skill is built around.
- [Zod 4](https://zod.dev/) — `z.email()`, `z.coerce.number()`, `.shape`, `z.infer`.
- [convex-helpers: Zod integration](https://stack.convex.dev/typescript-zod-function-validation) —
  `zCustomMutation`, `zCustomQuery`, `zodToConvex`, `zid`.
- [better-auth: Svelte client](https://better-auth.com/docs/concepts/client) — `authClient`,
  `signIn.email`, error shape (`message`, `code`, `status`), `$ERROR_CODES`.
- [better-auth: Email & password](https://www.better-auth.com/docs/authentication/email-password) —
  sign-in/sign-up options, email-verification gating.
- [sveltekit-flash-message](https://github.com/ciscoheat/sveltekit-flash-message) — toast messages
  that survive navigation; pairs with Superforms.
- [SvelteKit 2: `$app/paths` (`resolve`)](https://svelte.dev/docs/kit/$app-paths) — typed route
  resolution; required by `svelte/no-navigation-without-resolve` at call sites.
- [SvelteKit 2: `$app/navigation` (`goto`)](https://svelte.dev/docs/kit/$app-navigation) — the
  client-side redirect used inside `onUpdate`.
- Repo files worth referencing:
  - `src/lib/components/ui/form/` — shadcn form primitives (created by the `form` recipe).
  - `src/lib/auth-client.ts` — better-auth Svelte client instance.
  - `src/convex/_generated/api.js` — typed `api.<entity>.<fn>` identifiers for mutations.
  - `svelte.config.js` — `$convex` alias that makes the shared-schema pattern possible.
