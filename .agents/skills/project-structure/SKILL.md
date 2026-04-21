---
name: project-structure
description:
  Where files live in the fleet repo. SvelteKit 2 + Svelte 5 + Convex + shadcn-svelte + Superforms
  folder layout, colocation rules, and business-logic placement. Use when creating files, moving
  files, deciding where new logic belongs, or reviewing PRs that introduce new modules.
metadata:
  tags: structure, organization, conventions, sveltekit, convex, shadcn, superforms
---

## When to use

Use this skill whenever:

- Creating a new file (component, schema, utility, query, etc.)
- Deciding where a piece of logic belongs (route vs `$lib` vs `src/convex`)
- Moving or renaming files during refactors
- Reviewing PRs that add new modules or directories
- Onboarding a new feature and scaffolding its layout

Complementary skills in this repo:

- `sveltekit-best-practices` — Svelte 5 runes, load functions, form actions
- `shadcn-svelte` (TBD) — component authoring conventions
- `superforms` (TBD) — schema + action patterns

## Core principle

**Distance equals reuse.**

- Used by one thing → live next to it.
- Used by two or more → promote to `$lib` or `src/convex`.
- Runs on Convex infrastructure → `src/convex`.
- When in doubt, **colocate first**. Promote on the third usage, not the first.

Do not pre-build folder hierarchies "for later". Make directories when you have a file to put in
them.

## Top-level layout

```
src/
  convex/                   # Convex backend (queries/mutations/actions) — runs on Convex infra
    _generated/             # auto-generated, do not edit
    auth.ts                 # Convex auth functions
    tasks.ts                # domain functions (one file per entity/feature)
    http.ts                 # HTTP routes exposed by Convex
    convex.config.ts
    auth.config.ts
  lib/                      # SvelteKit library, imported as `$lib/...`
    components/             # NO index.ts at this level (no barrel re-exports)
      ui/                   # shadcn-svelte primitives (CLI-managed); NO index.ts at this level
        button/             # each component is a folder
          button.svelte
          index.ts          # re-exports the component + types
        dialog/
      app/                  # your composites; NO index.ts at this level
        user-menu/          # folder matches component name (kebab-case)
          user-menu.svelte
          index.ts
    schemas/                # Zod schemas shared by Superforms + client
    queries/                # typed wrappers around Convex useQuery / useMutation (optional)
    state/                  # *.svelte.ts rune-based cross-page state
    server/                 # server-only utilities (SvelteKit refuses to bundle into client)
    auth-client.ts          # better-auth client instance
    index.ts
  routes/                   # SvelteKit file-based routes
    +layout.svelte
    +layout.server.ts
    +page.svelte
    <feature>/
      +page.svelte
      +page.server.ts       # load + Superforms actions for this route
      +page.ts              # universal load (rare — use only if needed on both sides)
      components/           # route-scoped components (not reused elsewhere)
      schemas.ts            # route-local Zod schema (promote to $lib/schemas on reuse)
  hooks.server.ts           # auth, redirects, locals setup
  app.d.ts                  # App.Error, App.Locals, App.PageData type declarations
  app.html
```

## Critical Rules

### 1. Convex backend stays in `src/convex/` — never move it under `$lib`

**Why:**

- `convex.json` declares `"functions": "src/convex/"` and the Convex CLI reads from it
- `svelte.config.js` aliases `$convex` → `src/convex`, and generated types use that path
- Convex functions run on Convex infrastructure, not in the SvelteKit bundler. `$lib` is the
  SvelteKit bundler boundary — mixing them muddles build semantics
- shadcn, Superforms, and Convex all expect conventional layouts. Fight one, spend a weekend
  reconfiguring

**Correct:**

```typescript
// src/convex/tasks.ts
import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

export const list = query({
  handler: async (ctx) => await ctx.db.query('tasks').collect(),
});

export const create = mutation({
  args: { title: v.string() },
  handler: async (ctx, { title }) => ctx.db.insert('tasks', { title, done: false }),
});
```

**Wrong:**

- `src/lib/convex/tasks.ts` — breaks `convex.json`, the `$convex` alias, and `_generated` imports
- `convex/tasks.ts` (top level) — also fine in a vanilla Convex app, but this repo has already
  committed to `src/convex/`; do not split

### 2. All client library code lives in `src/lib/`, imported as `$lib/...`

SvelteKit ships exactly one source alias by default: `$lib` → `src/lib`. Anything you want to
import portably across routes must physically live under `src/lib`.

**Wrong:**

```
src/components/Button.svelte         # no alias reaches here
src/utils/format-date.ts             # ditto
src/stores/theme.svelte.ts           # ditto
```

**Correct:**

```
src/lib/components/app/Button.svelte
src/lib/utils/format-date.ts
src/lib/state/theme.svelte.ts
```

Do not introduce new top-level `src/*` folders. If you need a new category, add it under `$lib`.

### 3. shadcn components live in `$lib/components/ui/`; your composites in `$lib/components/app/`

**Why:**

- shadcn-svelte CLI writes to `$lib/components/ui/` by default — deviating means editing
  `components.json` and overriding every `add` command
- `ui/` vs `app/` split makes it obvious which components are CLI-managed primitives vs
  hand-written app composites. You can regenerate `ui/` without touching your work

**Correct (folder-per-component, matching shadcn CLI output):**

```
src/lib/components/
  ui/                         # shadcn primitives — CLI-managed
    button/
      button.svelte
      index.ts                # re-exports the component + types
    dialog/
      dialog.svelte
      dialog-content.svelte
      dialog-header.svelte
      index.ts
  app/                        # your composites — hand-written
    user-menu/
      user-menu.svelte
      index.ts
    task-card/
      task-card.svelte
      index.ts
    sign-in-form/
      sign-in-form.svelte
      index.ts
```

**Wrong:**

- `src/lib/components/Button.svelte` alongside `src/lib/components/ui/` — ambiguous location
- `src/lib/components/app/UserMenu.svelte` (flat file, no folder) — breaks the folder-per-component pattern
- `src/components/` — see rule 2

### 3a. Folder-per-component, with a local `index.ts` — always

Every component lives in its own folder named after the component. The folder contains the
`.svelte` file(s) plus an `index.ts` that re-exports the component and any related types. This
rule applies equally to shadcn primitives (where the CLI does it for you), `$lib/components/app/`
composites, and route-local components under `src/routes/<feature>/components/`.

**Single-component folder (most common):**

```
src/lib/components/app/user-menu/
  user-menu.svelte
  index.ts
```

```typescript
// index.ts
export { default as UserMenu } from './user-menu.svelte';
```

Consumers import from the folder, not the file:

```typescript
import { UserMenu } from '$lib/components/app/user-menu';
```

**Multi-file folder (component with sub-parts, matching shadcn's Dialog/Accordion pattern):**

```
src/lib/components/ui/dialog/
  dialog.svelte
  dialog-content.svelte
  dialog-header.svelte
  dialog-footer.svelte
  dialog-title.svelte
  dialog-description.svelte
  index.ts
```

```typescript
// index.ts — lets you namespace-import: `import * as Dialog from '$lib/components/ui/dialog'`
import Root from './dialog.svelte';
import Content from './dialog-content.svelte';
import Header from './dialog-header.svelte';
import Footer from './dialog-footer.svelte';
import Title from './dialog-title.svelte';
import Description from './dialog-description.svelte';

export {
  Root,
  Content,
  Header,
  Footer,
  Title,
  Description,
  //
  Root as Dialog,
};
```

Then in a consumer:

```svelte
<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog';
</script>

<Dialog.Root>
  <Dialog.Content>...</Dialog.Content>
</Dialog.Root>
```

### 3b. No barrel `index.ts` at `components/`, `ui/`, or `app/` level

Do **not** create `src/lib/components/index.ts`, `src/lib/components/ui/index.ts`, or
`src/lib/components/app/index.ts` that re-export everything underneath. These upper-level barrel
files cause:

- **Circular import risk** — touching one component drags the whole tree into the dependency graph
- **Worse tree-shaking** — bundlers evaluate the barrel's re-exports even when the consumer only
  needs one component
- **Harder navigation** — "jump to definition" lands on a re-export line, not the component
- **Noisy diffs** — adding a component forces an edit to the barrel file

**Wrong:**

```
src/lib/components/
  ui/
    index.ts              # ❌ NEVER — would re-export every ui component
    button/
    dialog/
  app/
    index.ts              # ❌ NEVER — would re-export every app component
    user-menu/
```

**Correct:** only per-component `index.ts` files exist. Consumers import from the component folder
directly (`$lib/components/app/user-menu`), never from `$lib/components/app`.

### 4. Business logic placement — use the table

With Convex in the picture, the usual "service layer in `$lib/server`" pattern does not apply.
Your service layer IS Convex.

| Logic kind                                     | Location                                         | Why                                                                                               |
| ---------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| DB reads/writes, authz, domain rules           | `src/convex/<entity>.ts` (query/mutation/action) | This is why Convex exists. Do not rewrap mutations in `$lib/server`                               |
| Route-specific load + form actions             | `src/routes/<path>/+page.server.ts`              | Colocate. Promote only on reuse                                                                   |
| Route-only components                          | `src/routes/<path>/components/`                  | Colocation scales better than a monolithic `$lib/components`                                      |
| Reusable schemas (Zod, shared client + server) | `src/lib/schemas/<entity>.ts`                    | Imported by `+page.server.ts` (Superforms) AND by client validation                               |
| Reusable types                                 | `src/lib/types/`                                 | Pure TypeScript declarations used across routes                                                   |
| Pure utilities (format, parse, map)            | `src/lib/utils/`                                 | No Svelte, no Convex — just functions                                                             |
| Typed Convex query wrappers                    | `src/lib/queries/<entity>.ts`                    | Optional. Wrap `useQuery(api.tasks.list, ...)` with a typed helper when call sites repeat         |
| Cross-page client state (runes)                | `src/lib/state/<name>.svelte.ts`                 | Must use `.svelte.ts` extension for runes. Export a class or factory, not a module-level `$state` |
| Server-only helpers (secrets, node APIs)       | `src/lib/server/`                                | SvelteKit throws a build error if client code imports this — intentional guardrail                |

### 5. Use `$lib/server/` for anything that must never reach the client bundle

SvelteKit refuses to bundle modules under `$lib/server/` into client code. This is a hard
guardrail against secret leakage — use it.

**Correct:**

```typescript
// src/lib/server/tokens.ts
import { env } from '$env/dynamic/private';

export function signAdminToken(payload: object): string {
  return sign(payload, env.ADMIN_SECRET);
}
```

With Convex, `$lib/server/` stays small. Most server-side logic belongs in `src/convex/`. Reach
for `$lib/server/` only when:

- You need a secret inside a SvelteKit `hooks.server.ts` or `+page.server.ts` that does not flow
  through Convex
- You are wrapping a Node-only library (filesystem, child_process, non-Convex DB)
- You are writing auth glue that runs in SvelteKit itself (not Convex)

### 6. Route colocation — promote to `$lib` on third reuse, not first

Start route-specific. If a component, schema, or helper is used by exactly one route, keep it
inside that route folder. Promote to `$lib` only when a third usage materialises.

**Correct (starting simple, folder-per-component as per rule 3a):**

```
src/routes/tasks/
  +page.svelte
  +page.server.ts
  schemas.ts              # route-local Zod schema
  components/             # NOT a URL route (see note below); NO index.ts at this level
    task-list/
      task-list.svelte
      index.ts
    task-row/
      task-row.svelte
      index.ts
```

**When `TaskRow` starts appearing in `/dashboard` too (2 usages):** leave it, note it.

**When `/search` also renders `TaskRow` (3 usages):** promote the entire folder to
`$lib/components/app/task-row/` (move the folder, keep the internal structure).

**Wrong:**

- Creating `$lib/components/app/task-row/` on the first render. Premature abstraction — you do
  not yet know the right prop shape, and refactoring a single-location component is free
- Keeping `task-row` route-local after it is imported from four routes. Now you have four import
  paths pointing at one implementation — move it
- A flat `components/task-row.svelte` without a folder — breaks the folder-per-component pattern
  in rule 3a

**Does `components/` become a URL route?** No. SvelteKit's file-based router only registers a
folder as a URL route when it contains a `+` prefixed special file (`+page.svelte`,
`+page.ts`, `+page.server.ts`, `+layout.svelte`, `+server.ts`, `+error.svelte`). A folder like
`src/routes/tasks/components/` that holds regular `.svelte` files but no `+` files is invisible to
the router — there is no `/tasks/components` URL. This colocation pattern is the
[officially recommended](https://svelte.dev/docs/kit/routing) way to keep route-scoped components
next to the page that owns them.

Related:

- Do **not** use `_components/` (underscore prefix) — SvelteKit does not treat underscore folders
  specially, that's a Next.js / Nuxt convention
- Do **not** use `(components)/` (parentheses) — those are
  [route groups](https://svelte.dev/docs/kit/advanced-routing#Advanced-layouts-group-layouts) that
  affect layout inheritance. Using them for non-route folders abuses the feature
- Dropping a `+page.svelte` inside `components/` *would* create a `/tasks/components` route. Don't.

### 7. Zod schemas go in `$lib/schemas/` (if shared) or route-local `schemas.ts` (if not)

Schemas are the bridge between Superforms server actions, client-side validation, and Convex
argument types. The rules:

- Used by only one route → colocate as `src/routes/<path>/schemas.ts`
- Shared across routes or imported by more than one `+page.server.ts` → `src/lib/schemas/<entity>.ts`
- Schemas specific to a Convex function → mirror the structure at `src/convex/schemas/` if it
  helps, but usually Convex's own `v.object(...)` argument validation is sufficient

**Correct:**

```typescript
// src/lib/schemas/task.ts
import { z } from 'zod';

export const taskSchema = z.object({
  title: z.string().min(1).max(200),
  done: z.boolean().default(false),
});
export type TaskInput = z.infer<typeof taskSchema>;
```

```typescript
// src/routes/tasks/+page.server.ts
import { taskSchema } from '$lib/schemas/task';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
// ...
```

### 8. Rune-based client state goes in `$lib/state/*.svelte.ts`

Modules with the `.svelte.ts` extension opt into runes outside of `.svelte` files. Export a class
or a factory — **do not** export a module-level `$state` variable, because importers will share a
single instance silently, which is rarely what you want.

**Correct:**

```typescript
// src/lib/state/preferences.svelte.ts
class PreferencesState {
  theme = $state<'light' | 'dark'>('light');
  density = $state<'cozy' | 'compact'>('cozy');

  toggleTheme() {
    this.theme = this.theme === 'light' ? 'dark' : 'light';
  }
}

export const preferences = new PreferencesState();
```

**Wrong (module-level rune — shared, non-obvious):**

```typescript
// src/lib/state/count.svelte.ts
export let count = $state(0); // shared across all importers, not always what you want
```

### 9. File and directory naming

| Thing                              | Convention                | Example                              |
| ---------------------------------- | ------------------------- | ------------------------------------ |
| Component folder                   | kebab-case                | `user-menu/`, `task-card/`, `button/` |
| Svelte component files             | kebab-case (matches folder) | `user-menu.svelte`, `button.svelte` |
| Component binding (what you import)| PascalCase via `index.ts` | `import { UserMenu } from '...user-menu'` |
| SvelteKit special files            | `+prefix` lowercase       | `+page.server.ts`, `+layout.svelte`  |
| TS modules (utils, schemas, types) | kebab-case                | `format-date.ts`, `task.ts`          |
| Rune state modules                 | kebab-case + `.svelte.ts` | `preferences.svelte.ts`              |
| Route folders                      | kebab-case                | `tasks/`, `org-settings/`            |
| Dynamic route params               | `[param]` or `[...rest]`  | `tasks/[id]/`, `docs/[...slug]/`     |

## Decision flowchart

When you do not know where a new file goes, walk this top-down:

1. **Does it run on Convex?** → `src/convex/<feature>.ts`. Stop.
2. **Does it import a secret or a Node-only API?** → `src/lib/server/<name>.ts`. Stop.
3. **Is it used by exactly one route?** → colocate in `src/routes/<path>/`. Stop.
4. **Is it a Svelte component?**
   - shadcn primitive → `src/lib/components/ui/` (let the CLI place it as a folder).
   - Your composite → `src/lib/components/app/<kebab-name>/<kebab-name>.svelte` + `index.ts`.
   - Always a folder, never a flat `.svelte` file (see rule 3a).
5. **Is it a Zod schema shared across routes?** → `src/lib/schemas/<entity>.ts`.
6. **Is it a client-side rune state module?** → `src/lib/state/<name>.svelte.ts`.
7. **Is it a pure utility or type?** → `src/lib/{utils,types}/`.
8. **Anything else?** → default to `src/lib/<category>/`. If a new category appears 3+ times,
   promote it to a top-level `$lib` subfolder.

## Patterns

- **Convex + SSR seeding:** fetch initial data in `+page.server.ts` via `createConvexHttpClient`,
  pass it as `initialData` to `useQuery` in `+page.svelte`. See `src/routes/+layout.server.ts` and
  `src/routes/+page.svelte` for the canonical example.
- **Route-scoped Superforms:** keep schema in `src/routes/<feature>/schemas.ts` until a second
  route needs it; then lift to `$lib/schemas/`.
- **Entity ownership:** one Convex file per entity (`tasks.ts`, `users.ts`), one schema file per
  entity in `$lib/schemas/`, one route segment per entity (`/tasks`, `/users`). Parallel naming
  makes grep-driven navigation trivial.
- **Generated code:** never hand-edit `src/convex/_generated/`. Regenerate via `npx convex dev`.

## Anti-Patterns

- Do not create `src/components/`, `src/utils/`, `src/stores/`, etc. — all library code goes under
  `src/lib/`
- Do not move `src/convex/` under `$lib/` — breaks the `$convex` alias and `convex.json`
- Do not build a `$lib/server/` service layer that wraps Convex mutations — put the logic in
  `src/convex/`; rewrapping gives you two sources of truth
- Do not mix shadcn primitives and your own composites in the same directory — keep `ui/` vs `app/`
- Do not create a flat `.svelte` component file outside a folder (e.g., `$lib/components/app/UserMenu.svelte`) — every component is a folder with an `index.ts` (rule 3a)
- Do not create a barrel `index.ts` at `$lib/components/`, `$lib/components/ui/`, or `$lib/components/app/` that re-exports everything under it — see rule 3b
- Do not colocate route-only components in `$lib/components/` "just in case" — that is premature
  abstraction and pollutes the shared surface
- Do not export a module-level `$state` variable from a `.svelte.ts` file unless you genuinely want
  a global singleton — prefer a class or factory
- Do not put secret-bearing code outside `$lib/server/` — you lose the build-time leak guardrail
- Do not hand-edit `src/convex/_generated/` — it is regenerated on every `npx convex dev`
- Do not scatter Zod schemas across route files when three routes use the same entity — promote

## References

### SvelteKit

- [Project structure](https://svelte.dev/docs/kit/project-structure) — canonical layout, `$lib`,
  `$lib/server`, `src/params`, `src/hooks.*`
- [`$lib`](https://svelte.dev/docs/kit/$lib) — alias semantics, `$lib/server/` guardrail
- [Routing](https://svelte.dev/docs/kit/routing) — `+page`, `+layout`, `+error`, `+server`
- [Configuration: alias](https://svelte.dev/docs/kit/configuration#alias) — adding project aliases

### Convex

- [Directory structure](https://docs.convex.dev/production/project-configuration) — `convex.json`
  `functions` key, `_generated/`
- [Functions](https://docs.convex.dev/functions) — one-file-per-entity convention
- [`convex-svelte` integration](https://github.com/get-convex/convex-svelte)

### shadcn-svelte

- [SvelteKit installation](https://www.shadcn-svelte.com/docs/installation/sveltekit) — default
  paths and `components.json`
- [CLI](https://www.shadcn-svelte.com/docs/cli) — `add`, `init`, path overrides

### Superforms

- [Get started](https://superforms.rocks/get-started) — where schemas live, load + action shape
- [Concepts: Nested data and schemas](https://superforms.rocks/concepts/nested-data)
