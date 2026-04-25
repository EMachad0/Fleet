## When to use

Use this doc whenever you are:

- Building a login, signup, password-reset, or email-verification form (better-auth flows)
- Building a CRUD dialog or page form for a Convex entity (create, edit, delete)
- Building a search/filter/settings form that collects user input before calling an API
- Wiring validation, error display, or form submission in any `.svelte` file
- Reviewing a PR that introduces new form UI

## Core principles

1. **One form library.** Every form uses `sveltekit-superforms`. Never a bespoke `$state` +
   `<form onsubmit>` + manual validation.
2. **One schema library.** Every form schema is Zod.
3. **One source of truth for shared shapes.** Shared Convex schemas live in
   `src/convex/schemas/<entity>.ts` and are used by both client and server (see
   `project-structure.md` rule 7).
4. **Client-only (SPA) is the default.** Convex and better-auth are client-callable; most forms do
   not need a SvelteKit form action.
5. **Formsnap/shadcn for UI.** Wire every field through `<Form.Field>`, `<Form.Control>`,
   `<Form.Label>`, `<Form.FieldErrors>` (see `shadcn-svelte.md` rule 3 for CLI install gotchas).
6. **TypeScript always.** Zero type errors. `bun run check` clean before a change is done.
7. **Prettier always.** `bun run format` after every form change.

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

This reinvents everything Superforms gives you: validation, error state, field-level messages,
loading/submitting state, taint tracking, accessibility, typed data.

**Correct:** see the canonical pattern below.

### 2. Use `createForm` — the project wrapper — never call `superForm` directly

**Never call `superForm` directly in a component.** Use `createForm` from `$lib/forms`. It hides
the `zod4` / `zod4Client` adapter split, bakes in the app's defaults (`SPA: true`,
`resetForm: false`, client validators), and keeps every form in the repo identical on the config
side.

See `src/lib/forms/create-form.ts` for the full implementation.

**Usage:**

```typescript
import { createForm } from '$lib/forms';
import { carCreateSchema } from '$convex/schemas/car';

const form = createForm({
  schema: carCreateSchema,
  onUpdate: async ({ form }) => {
    if (!form.valid) return;
    // call API here
  },
});
```

**Don't use `onSubmit` for the API call in SPA mode.** `onSubmit` fires _before_ validation.
Always call Convex / better-auth / APIs from `onUpdate`, which runs after validation passes.

**Overriding defaults:**

```typescript
createForm({
  schema: mySchema,
  SPA: undefined, // opt out of SPA mode — submit to form action instead
  resetForm: true, // clear on successful submit
  validationMethod: 'onblur',
  onUpdate: ({ form }) => {
    /* ... */
  },
});
```

### 3. Shared Convex schemas + `zMutation` / `zQuery` / `zAction`

For the shared Convex builders (`zMutation`, `zQuery`, `zAction`), see `src/convex/functions.ts`.

**Usage:**

```typescript
// src/convex/cars.ts
import { zMutation } from './functions';
import { carCreateSchema } from './schemas/car';

export const create = zMutation({
  args: carCreateSchema.shape,
  handler: async (ctx, args) => {
    return await ctx.db.insert('cars', { ...args, createdAt: Date.now() });
  },
});
```

**Don't** redeclare `const zMutation = zCustomMutation(mutation, NoOp)` in every endpoint file.
Import from `./functions`.

### 4. UI via shadcn-svelte's `form` component (wraps Formsnap)

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

**Anatomy:**

- `<Form.Field {form} name="...">` — scopes state for one field; the `name` **must** match a
  top-level key in the schema.
- `<Form.Control>` with `{#snippet children({ props })}` — spreads generated `id`, `name`,
  `aria-*`, `data-fs-error` attrs onto the input.
- `<Form.Label>` — automatically gets `for={field.id}`.
- **Any input** — `<Input>`, `<Textarea>`, `<Select>`, `<Checkbox>`, etc. Spread `{...props}` onto
  it and `bind:value={$formData.<field>}`.
- `<Form.Description>` — optional helper text. Auto-wired to `aria-describedby`.
- `<Form.FieldErrors />` — renders the Zod validation messages for this field.

**Form-level errors:**

```svelte
{#if $message}
  <Alert variant="destructive">{$message}</Alert>
{/if}
```

Display with `setMessage(form, 'text')` from `onUpdate`.

### 5. Auth flows wrap better-auth inside Superforms

Never call `authClient.signIn.email(...)` directly from a component's `onclick`. Always wrap it in
a Superforms `onUpdate`:

```typescript
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
};
```

### 6. Redirects: `goto(resolve(...))` in SPA mode; `sveltekit-flash-message` for toasts

**A. Successful submit → navigate to another route:**

```typescript
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

// inside onUpdate after success
await goto(resolve('/dashboard'));
```

**B. Redirect with a toast message:**

```typescript
import { setFlash } from 'sveltekit-flash-message/client';
import { page } from '$app/state';

// inside onUpdate after success
setFlash({ type: 'success', message: 'Car created' }, page);
await goto(resolve('/cars'));
```

**Don't** show a toast _and_ navigate in the same tick without flash-message — the destination page
re-renders and the toast is lost.

### 7. Action mode only when you genuinely need progressive enhancement

Use SvelteKit form actions **only** when:

- The form must work without JavaScript (rare)
- You're handling a webhook callback, OAuth redirect, or other true-POST endpoint
- A third-party service posts to your app and expects a 302 redirect

**For every other form (login, signup, CRUD, settings, search) — use SPA mode.**

### 8. TypeScript, format, check — every time

After creating or modifying a form:

```sh
bun run format
bun run check
```

Both must be clean before the form is considered done. No `any`, no `@ts-ignore`, no
`@ts-expect-error` in form code.

## Canonical Pattern

The canonical pattern for this project: SSR-seeded edit form with `convexLoad` in `+page.ts` for
initial values, direct `convex.mutation()` on client submit, and shared Zod schema between client
form and Convex function.

**Files:**

```
src/convex/schemas/car.ts                    # shared Zod schema
src/convex/cars.ts                           # Convex mutation using zMutation
src/routes/cars/[id]/edit/
  +page.server.ts                            # auth guard (optional)
  +page.ts                                   # convexLoad to seed the form
  +page.svelte                               # passes data to form component
  components/
    car-edit-form/
      car-edit-form.svelte                   # form using createForm
      index.ts
```

### Schema (shared between client and Convex)

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

export const carUpdateSchema = carCreateSchema.partial().extend({
  id: z.string(),
});

export type CarUpdate = z.infer<typeof carUpdateSchema>;
```

### Convex mutation

```typescript
// src/convex/cars.ts
import type { Id } from './_generated/dataModel';
import { query } from './_generated/server';
import { zid } from 'convex-helpers/server/zod4';
import { zMutation, zQuery } from './functions';
import { carCreateSchema, carUpdateSchema } from './schemas/car';

export const get = zQuery({
  args: { id: zid('cars') },
  handler: async (ctx, { id }) => ctx.db.get(id),
});

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

export const update = zMutation({
  args: carUpdateSchema.shape,
  handler: async (ctx, { id, ...rest }) => {
    await ctx.db.patch(id as Id<'cars'>, rest);
  },
});
```

### Auth guard (optional)

```typescript
// src/routes/cars/[id]/edit/+page.server.ts
import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';

export const load = async ({ locals }) => {
  if (!locals.user) {
    redirect(303, resolve('/login'));
  }
};
```

### Universal load with convexLoad

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

### Page component

```svelte
<!-- src/routes/cars/[id]/edit/+page.svelte -->
<script lang="ts">
  import { CarEditForm } from './components/car-edit-form';

  let { data } = $props();
</script>

<div class="container mx-auto max-w-2xl py-8">
  <h1 class="mb-6 text-3xl font-bold">Edit Car</h1>
  <CarEditForm form={data.form} carId={data.carId} />
</div>
```

### Form component

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

<form method="POST" use:enhance class="flex w-full flex-col gap-4">
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

  <Button type="submit" disabled={$submitting || !$tainted}>
    {$submitting ? 'Saving…' : 'Save changes'}
  </Button>
</form>
```

```typescript
// src/routes/cars/[id]/edit/components/car-edit-form/index.ts
export { default as CarEditForm } from './car-edit-form.svelte';
```

**Key points:**

- `+page.ts` runs on both server (SSR) and client (navigation), producing initial HTML with
  pre-filled values
- `superValidate(car, zod4(carUpdateSchema))` validates the seed against the schema
- Submission goes client-side to `convex.mutation(api.cars.update, form.data)` — no server action
- `$tainted` disables Save until the user changes something, preventing accidental no-op mutations
- Schema is shared: `src/convex/schemas/car.ts` imported by both Convex function and client form

## Decision flowchart

```
Need a form?
│
├─ Convex entity (create/update/delete)?
│   Schema: src/convex/schemas/<entity>.ts (shared)
│   Submit: SPA mode → convex.mutation(...) in onUpdate
│   Seed:
│     • empty/create  → createForm({ schema, onUpdate })
│     • prefilled     → +page.ts loads via superValidate(row, zod4(...))
│                       createForm({ schema, data: data.form, onUpdate })
│     • auth-gated    → +page.server.ts loads via superValidate
│                       createForm({ schema, data: data.form, onUpdate })
│   File: src/routes/<entity>/<path>/components/<kebab-name>/<kebab-name>.svelte
│
├─ Auth form (sign in/up/reset/verify)?
│   Schema: $lib/schemas/<name>.ts (client-only)
│   Submit: SPA mode → authClient.<method>(...) in onUpdate
│   Seed: createForm({ schema, onUpdate })
│   File: src/routes/(auth)/<name>/components/<kebab-name>/<kebab-name>.svelte
│
├─ UI-only form (filter/search/settings)?
│   Schema: route-local schemas.ts or $lib/schemas/<name>.ts
│   Submit: SPA mode → orchestration in onUpdate
│   Seed: createForm({ schema, onUpdate })
│
└─ Progressive enhancement (no-JS/OAuth/webhook)?
    Mode: action — createForm({ schema, SPA: undefined })
    Route: +page.server.ts load + actions.default
```

## Rules (compressed)

**Don't:**

- Call `superForm` directly in components — use `createForm` from `$lib/forms`
- Import `zod4` or `zod4Client` in `.svelte` files — they live inside `createForm`
- Write bespoke `$state` + `onsubmit` forms — if it's a form, use Superforms
- Define parallel Zod + Convex `v.*` schemas for the same shape — use shared schema in
  `src/convex/schemas/`
- Put client-only schemas in `src/convex/schemas/` — use `$lib/schemas/` instead
- Redeclare `zMutation = zCustomMutation(...)` in every file — import from `./functions`
- Assume `SPA: true` disables SSR — it only disables POST-to-action on submit
- Use `defaults(car, ...)` for edit forms when you have data server-side — use
  `superValidate(car, zod4(schema))` to validate the seed
- Reach for form actions just to call `convex.mutation(...)` — use SPA mode instead
- Call `authClient.*` or `convex.mutation(...)` from `onclick` without Superforms — wrap in
  `onUpdate`
- Use `onSubmit` for API calls in SPA mode — it fires before validation, use `onUpdate` instead
- Hand-wire `<label for>` / `<input id>` / `<aria-describedby>` — use Formsnap primitives
- Catch mutation errors silently — every `catch` must call `setError(form, '', ...)`
- Skip `bun run format` / `bun run check` after form changes
- Import `$lib/schemas/<entity>` into Convex — Convex can't resolve `$lib`
- Use `validators: zod4(schema)` on client — use `validators: zod4Client(schema)` instead
- Toast-and-navigate in the same tick — use `setFlash(...)` before `goto(...)`
- Commit `src/convex/_generated/` edits by hand — regenerate via `bun x convex@latest dev`

## References

- [sveltekit-superforms home](https://superforms.rocks/) — concepts, API, examples
- [Superforms: SPA mode](https://superforms.rocks/concepts/spa) — the default pattern for this app
- [Superforms: Events](https://superforms.rocks/concepts/events) — `onSubmit`, `onUpdate`,
  `onUpdated`, `onError`
- [Superforms: Validators](https://superforms.rocks/concepts/validators) — `validators` option,
  `validationMethod`, partial validation
- [Superforms: Default values](https://superforms.rocks/default-values) — `defaults()` helper
- [Superforms: Error handling](https://superforms.rocks/concepts/error-handling) — `setError`,
  form-level errors, `$message`
- [Superforms: Tainted fields](https://superforms.rocks/concepts/tainted) — dirty-state tracking
- [Formsnap docs](https://formsnap.dev/) — primitives shadcn wraps (`Field`, `Control`, `Label`,
  `FieldErrors`, `Description`)
- [shadcn-svelte: Form component](https://www.shadcn-svelte.com/docs/components/form) — install +
  anatomy
- [Zod 4](https://zod.dev/) — `z.email()`, `z.coerce.number()`, `.shape`, `z.infer`
- [convex-helpers: Zod integration](https://stack.convex.dev/typescript-zod-function-validation) —
  `zCustomMutation`, `zCustomQuery`, `zodToConvex`, `zid`
- [better-auth: Svelte client](https://better-auth.com/docs/concepts/client) — `authClient`,
  `signIn.email`, error shape (`message`, `code`, `status`)
- [better-auth: Email & password](https://www.better-auth.com/docs/authentication/email-password) —
  sign-in/sign-up options, email-verification gating
- [sveltekit-flash-message](https://github.com/ciscoheat/sveltekit-flash-message) — toast messages
  that survive navigation
- [SvelteKit 2: `$app/paths` (`resolve`)](https://svelte.dev/docs/kit/$app-paths) — typed route
  resolution
- [SvelteKit 2: `$app/navigation` (`goto`)](https://svelte.dev/docs/kit/$app-navigation) —
  client-side redirect
