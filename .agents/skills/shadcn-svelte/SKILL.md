---
name: shadcn-svelte
description:
  How to build UI in the fleet repo with shadcn-svelte + Tailwind v4 + Svelte 5. Use whenever
  writing any frontend file — components, pages, layouts, or route components. Covers the component
  creation workflow, the shadcn CLI (bun), where Tailwind lives, TypeScript and formatting
  requirements, and when to escalate to the user.
metadata:
  tags: shadcn, shadcn-svelte, tailwind, ui, components, svelte, bun
---

## When to use

Consult this skill whenever you are:

- Creating a new `.svelte` component, page, or layout
- Modifying an existing component's styling or structure
- Importing a new shadcn-svelte component via the CLI
- Deciding whether to create a new component or extend an existing one
- Reviewing frontend PRs

**Complementary skills (load them when relevant):**

- `project-structure` — where files live (`$lib/components/ui`, `$lib/components/app`, route-local)
- `sveltekit-best-practices` — Svelte 5 runes, `$props`, `$state`, `{@render ...}`

## Core principles

1. **Composition over styling.** Pages and layouts compose components. Components hold the
   Tailwind. If a page has more than a handful of utility classes, you are missing a component.
2. **Search before you create.** Existing `$lib/components/ui/*` first → shadcn registry second →
   new component last.
3. **No duplication.** Never copy-paste a component. Reuse from where it lives, or promote to
   `$lib/components/*`.
4. **TypeScript always.** Zero type errors before you consider a change done (`bun run check`).
5. **Prettier always.** After any change to `.svelte` / `.ts` / CSS, run `bun run format`.
6. **Escalate ambiguity.** If you are not sure whether to create a new component, stop and ask.

## Critical Rules

### 1. Tailwind lives in components, not pages or layouts

Pages (`+page.svelte`) and layouts (`+layout.svelte`) are for **composition** — they assemble
components, handle layout-level structure (`<svelte:head>`, grid wrappers), and wire data. They
should contain as close to zero Tailwind classes as possible.

**Wrong (Tailwind bloat in a page):**

```svelte
<!-- src/routes/tasks/+page.svelte -->
<script lang="ts">
  let { data } = $props();
</script>

<div class="flex h-screen flex-col items-center justify-center bg-gray-50 p-6">
  <div class="flex w-full max-w-md flex-col gap-4 rounded-lg bg-white p-6 shadow-md">
    <h2 class="mb-6 text-center text-2xl font-bold text-gray-800">Tasks</h2>
    {#each data.tasks as task}
      <div class="flex items-center gap-2 rounded border p-3">
        <input type="checkbox" class="size-4" checked={task.done} />
        <span class="text-sm text-gray-700">{task.title}</span>
      </div>
    {/each}
  </div>
</div>
```

**Correct (page composes components, folder-per-component with `index.ts`):**

```svelte
<!-- src/routes/tasks/+page.svelte -->
<script lang="ts">
  import { PageShell } from '$lib/components/app/page-shell';
  import { TaskList } from './components/task-list';
  let { data } = $props();
</script>

<PageShell title="Tasks">
  <TaskList tasks={data.tasks} />
</PageShell>
```

```svelte
<!-- src/routes/tasks/components/task-list/task-list.svelte -->
<script lang="ts">
  import { TaskRow } from '../task-row';
  import type { Task } from '$lib/schemas/task';

  let { tasks }: { tasks: Task[] } = $props();
</script>

<div class="flex flex-col gap-2">
  {#each tasks as task (task._id)}
    <TaskRow {task} />
  {/each}
</div>
```

```typescript
// src/routes/tasks/components/task-list/index.ts
export { default as TaskList } from './task-list.svelte';
```

**Why:** Tailwind classes at the page level are impossible to reuse and become the enemy of
consistency. Pushing them into components gives you a single place to adjust spacing, colors, or
density.

**When a tiny bit of layout Tailwind is OK on a page:** a single wrapper `<div class="container mx-auto py-8">`
to set the page's outer box is fine. Everything inside that wrapper should be components.

### 2. Component creation workflow — search, extend, create (in that order)

When you need a UI element, walk this decision tree. Do not skip steps.

```
1. Does $lib/components/ui/* or $lib/components/app/* already have it?
   └─ YES → import and use it. Stop.
   └─ NO  → go to 2.

2. Does shadcn-svelte's registry have a component that fits (or nearly fits)?
   └─ YES → `bun x shadcn-svelte@latest add <name>`, then customize if needed.
            Keep customizations generic (no feature-specific props).
            You MAY also build a feature-specific wrapper (step 3) that consumes it.
            Stop.
   └─ NO  → go to 3.

3. Build a new component (folder-per-component, see `project-structure` rule 3a).
   ├─ Generic + reusable across routes → $lib/components/app/<kebab-name>/
   │                                       <kebab-name>.svelte
   │                                       index.ts
   └─ Feature/page-specific           → src/routes/<feature>/components/<kebab-name>/
                                          <kebab-name>.svelte
                                          index.ts

   Never create a flat <Name>.svelte file. Always a folder with index.ts.

   If uncertain which bucket it belongs in → ESCALATE: present a short plan to the
   user with the proposed location, prop shape, and whether it wraps a shadcn
   primitive. Ask for confirmation before writing code.
```

**Combination pattern (common and good):** add a shadcn primitive and wrap it for your domain.

```sh
bun x shadcn-svelte@latest add dialog
```

Then, as a folder-per-component wrapper:

```svelte
<!-- src/routes/tasks/components/delete-task-dialog/delete-task-dialog.svelte -->
<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog';
  import { Button } from '$lib/components/ui/button';
  import type { Task } from '$lib/schemas/task';

  let {
    task,
    open = $bindable(false),
    onConfirm,
  }: { task: Task; open?: boolean; onConfirm: () => void } = $props();
</script>

<Dialog.Root bind:open>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Delete task</Dialog.Title>
      <Dialog.Description>This will permanently delete "{task.title}".</Dialog.Description>
    </Dialog.Header>
    <Dialog.Footer>
      <Button variant="outline" onclick={() => (open = false)}>Cancel</Button>
      <Button variant="destructive" onclick={onConfirm}>Delete</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
```

```typescript
// src/routes/tasks/components/delete-task-dialog/index.ts
export { default as DeleteTaskDialog } from './delete-task-dialog.svelte';
```

Consumer imports it as:

```typescript
import { DeleteTaskDialog } from './components/delete-task-dialog';
```

The shadcn `Dialog` stays generic in `$lib/components/ui/dialog/`; the `delete-task-dialog/`
folder encodes your domain and lives next to the route that uses it.

### 3. shadcn CLI — always use bun

This repo uses bun (`bun.lock` present). Always use `bun x shadcn-svelte@latest ...` — do not use
`npx` or `pnpm dlx`, even if you see them in shadcn's docs.

**Add a single component:**

```sh
bun x shadcn-svelte@latest add button
```

**Add multiple components at once:**

```sh
bun x shadcn-svelte@latest add dialog dropdown-menu input label
```

**Add without installing dependencies** (e.g., if the package is already present):

```sh
bun x shadcn-svelte@latest add dialog --no-deps
```

**Overwrite an existing component** (e.g., after modifying and wanting to re-pull the original):

```sh
bun x shadcn-svelte@latest add button --overwrite
```

**Skip confirmation prompt** (for scripts):

```sh
bun x shadcn-svelte@latest add button --yes
```

**After `add`, always run:**

```sh
bun run format   # runs prettier --write
bun run check    # svelte-check, must be clean
```

Config is already done — `components.json` at the repo root declares:

- `style: "luma"` (custom style, do not change on a whim)
- `iconLibrary: "lucide"` → import icons from `@lucide/svelte`
- `tailwind.css: "src/routes/layout.css"`
- Aliases: `components → $lib/components`, `ui → $lib/components/ui`, `utils → $lib/utils`,
  `hooks → $lib/hooks`, `lib → $lib`

Do not rerun `init`. If something looks broken in `components.json`, ask before changing.

### 4. Component location — ui vs app vs route-local (folder-per-component everywhere)

Every component — shadcn primitive, composite, or route-local — lives in its own kebab-case
folder with an `index.ts`. See `project-structure` rules 3a and 3b.

| Component kind                                   | Location                                                              | Ownership          |
| ------------------------------------------------ | --------------------------------------------------------------------- | ------------------ |
| shadcn primitives (generic, registry-managed)    | `src/lib/components/ui/<kebab>/<kebab>.svelte` + `index.ts`           | shadcn CLI         |
| Your composite primitives (generic, cross-route) | `src/lib/components/app/<kebab>/<kebab>.svelte` + `index.ts`          | You. Hand-written. |
| Feature-specific component (used by one route)   | `src/routes/<feature>/components/<kebab>/<kebab>.svelte` + `index.ts` | You. Colocated.    |

**Rules:**

- Never mix shadcn primitives and your composites in the same directory. `ui/` is CLI territory;
  `app/` is yours. You can regenerate `ui/` without touching `app/`.
- **Never a flat `.svelte` file.** Even a single-component folder gets its own directory with
  the component file + `index.ts`. The shadcn CLI does this for `ui/` already; match it in
  `app/` and route-local components.
- **Never a barrel at the upper level.** No `$lib/components/index.ts`,
  `$lib/components/ui/index.ts`, `$lib/components/app/index.ts`, nor
  `src/routes/<feature>/components/index.ts`. Consumers import from the component folder
  directly (`$lib/components/app/user-menu`), not from the parent.
- If a component in `$lib/components/app/` still encodes feature-specific concepts (e.g., knows
  about "tasks"), it is misplaced — move its folder to the route's `components/` folder.
- If a component in `src/routes/<feature>/components/` gets imported by a second route, **do not
  duplicate it**. Either import it from the original location (fine for adjacent features) or
  promote the whole folder to `$lib/components/app/`.

**Minimal `index.ts` for a single-component folder:**

```typescript
// src/lib/components/app/user-menu/index.ts
export { default as UserMenu } from './user-menu.svelte';
```

**Multi-file `index.ts` (namespace-import pattern, like shadcn Dialog):**

```typescript
// src/lib/components/ui/dialog/index.ts
import Root from './dialog.svelte';
import Content from './dialog-content.svelte';
import Header from './dialog-header.svelte';
import Footer from './dialog-footer.svelte';

export { Root, Content, Header, Footer, Root as Dialog };
```

Consumer:

```typescript
import * as Dialog from '$lib/components/ui/dialog';
// <Dialog.Root>, <Dialog.Content>, ...
```

### 5. No component duplication — ever

If you find yourself copy-pasting a component file, stop. You have two choices:

1. **Import from the existing location.** Route A can import from `src/routes/<featureB>/components/<x>`
   (the folder, which resolves via its `index.ts`) if you want to keep the ownership with feature B.
   This is fine for short-term sharing.
2. **Promote.** Move the whole `<x>/` folder (both `.svelte` and `index.ts`) to
   `$lib/components/app/<x>/` and update both importers to `$lib/components/app/<x>`. This is
   the right long-term answer once 2+ routes depend on it.

Variations that still count as duplication:

- Same component with a different name but 90% identical markup → extract
- Two components that only differ in one class or one prop → parameterize, don't duplicate
- Same Tailwind class string sprinkled across multiple components → extract either to a component
  or to a shared class helper (`cn(...)` with a base string in `$lib/utils`)

### 6. Always TypeScript, always zero type errors

Every component must use `<script lang="ts">`. Every prop must be typed via `$props()` with an
explicit type.

**Correct:**

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils';

  interface Props {
    title: string;
    variant?: 'default' | 'muted';
    class?: string;
    children?: Snippet;
  }

  let { title, variant = 'default', class: className, children }: Props = $props();
</script>

<section class={cn('rounded-lg border p-4', variant === 'muted' && 'bg-muted', className)}>
  <h2 class="text-lg font-semibold">{title}</h2>
  {@render children?.()}
</section>
```

**Rules:**

- Always type `$props()`. If it has many props, declare `interface Props` above and use it. For
  2–3 props, inline types are fine.
- For props that forward DOM attributes, use `WithElementRef<HTMLButtonAttributes>` (and siblings)
  from `$lib/utils` — see the existing `button.svelte` for the canonical pattern.
- Use `Snippet` from `svelte` for snippet props. Default optional snippets with optional chaining
  (`{@render children?.()}`) — see `sveltekit-best-practices` rule 14.
- Run `bun run check` before considering work done. No `any`, no `// @ts-ignore`.

### 7. Always run prettier after changes

Prettier is configured with `prettier-plugin-svelte` and `prettier-plugin-tailwindcss` (auto-sorts
Tailwind classes). After ANY change — new component, `add` from CLI, edit to an existing file —
run:

```sh
bun run format
```

Then verify no type regressions:

```sh
bun run check
```

The `format` step will re-sort Tailwind classes; commit the result. Do not hand-order Tailwind
classes — the plugin does it for you.

### 8. Keep Tailwind minimal — simple, semantic, extract early

Tailwind is a tool, not a styling philosophy. The shorter your class strings, the easier the
component is to read and modify.

**Red flags:**

- A class string longer than ~80 characters on one element → time to extract a sub-component or
  use `tailwind-variants`
- Repeating the same 5+ class combination across multiple components → extract
- Arbitrary values (`p-[7px]`, `text-[#3f3f3f]`) → check if a design token exists first; if not,
  add one to the theme rather than using one-off values

**Correct (simple, uses design tokens):**

```svelte
<div class="rounded-lg border bg-card p-4 text-card-foreground">
  {@render children()}
</div>
```

**Wrong (over-specified, hardcoded values, duplicated elsewhere):**

```svelte
<div
  class="rounded-[8px] border border-[#e5e5e5] bg-white p-[16px] text-[#0f0f0f] shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
>
  {@render children()}
</div>
```

**When using `tailwind-variants` (like shadcn primitives do):** follow the `button.svelte` pattern
— base classes in `base:`, variant branches declarative, `defaultVariants` set. Do not mix `tv()`
variants with inline conditional classes on the same element.

### 9. Escalate ambiguity before writing code

If you are unsure whether to:

- Create a new component or extend an existing one
- Promote a route-local component folder to `$lib/components/app/`
- Add a shadcn primitive you have not used before
- Change `components.json`, Tailwind config, or global CSS

**Stop. Present a short plan to the user** with:

1. What you want to create/move/add and where it will live
2. The proposed public API (props + slots/snippets)
3. Whether it wraps a shadcn primitive or is new
4. A one-line justification

Wait for confirmation before writing code.

### 10. Follow Svelte 5 best practices

Every rule in `sveltekit-best-practices` applies:

- Use `$state`, `$derived`, `$effect`, `$props`, `$bindable` — never Svelte 4 stores or `$:`
- Snippets with `{@render ...}`, not slots
- Optional snippet props: `{@render children?.()}`
- For two-way binding props: `$bindable()`
- For `+error.svelte`: read from `page.error` / `page.status`, not `$props()`

Do not reimplement Svelte 4 idioms just because "that's how I saw it on Stack Overflow".

## Component creation decision flowchart

```
Need a UI element?
│
├─ Already in $lib/components/{ui,app}? ─── YES ──→ import and use. DONE.
│                         │
│                         NO
│                         ↓
├─ Already in the route's components/? ──── YES ──→ import and use. DONE.
│                         │
│                         NO
│                         ↓
├─ Exists in shadcn-svelte registry? ─────── YES ──→ bun x shadcn-svelte@latest add <name>
│                         │                          (optionally wrap in a feature component)
│                         │                          format + check. DONE.
│                         NO
│                         ↓
├─ Clear where it belongs? ─────────────── YES ──→ create folder app/<kebab>/ or
│                         │                          routes/<f>/components/<kebab>/ with
│                         │                          <kebab>.svelte + index.ts
│                         │                          format + check. DONE.
│                         NO
│                         ↓
└─ UNCLEAR → present plan to user, wait for confirmation before coding.
```

## Patterns

### Anatomy of a shadcn-derived component

After `bun x shadcn-svelte@latest add <name>`, you get a file like `button.svelte` that:

- Uses `<script lang="ts" module>` for the `tv()` variants export and the `Props` type
- Uses `<script lang="ts">` for the component instance logic
- Uses `tailwind-variants` for styling variants
- Forwards `class` via `cn(buttonVariants({ variant, size }), className)`
- Forwards `ref` via `bind:this={ref}`
- Uses `WithElementRef<HTMLButtonAttributes>` to type DOM-forwarded props

**When customizing a shadcn component:** keep the structure. Change `tv()` variants, tweak base
classes, add new variants — do not rip out `tv()` and replace with inline classes. Consistency
with the registry pattern makes future `--overwrite` diffs readable.

### Composing shadcn + domain wrappers

The `DeleteTaskDialog` example in rule 2 is the canonical shape:

- Feature-specific wrapper in `src/routes/<feature>/components/`
- Imports shadcn primitives from `$lib/components/ui/*`
- Encodes the domain (task, user, org, etc.) in its prop shape
- Exposes a small, task-appropriate API (`task`, `open`, `onConfirm`) — not the raw primitive's
  full surface

### Icons from lucide

The icon library is configured as `lucide`. Icons come from `@lucide/svelte`:

```svelte
<script lang="ts">
  import Trash from '@lucide/svelte/icons/trash';
</script>

<Trash class="size-4" />
```

Do not install alternate icon packages. If you need an icon lucide does not have, ask before
adding a second icon library.

## Anti-Patterns

- Do not sprinkle Tailwind across pages and layouts — extract a component
- Do not use `npx` or `pnpm dlx` with shadcn — always `bun x shadcn-svelte@latest`
- Do not copy-paste components — import or promote
- Do not create `src/components/` or similar — UI lives under `$lib/components/`
- Do not mix your composites into `$lib/components/ui/` — that directory is CLI-managed
- Do not create a flat component file like `$lib/components/app/UserMenu.svelte` — always a folder (`user-menu/user-menu.svelte` + `user-menu/index.ts`)
- Do not create a barrel `index.ts` at `$lib/components/`, `$lib/components/ui/`, `$lib/components/app/`, or `src/routes/<feature>/components/` — those upper levels stay barrel-free
- Do not mix PascalCase and kebab-case filenames (e.g., `user-menu/UserMenu.svelte`) — match shadcn: kebab-case folder + kebab-case file, PascalCase only for the exported binding
- Do not hand-sort Tailwind classes — `prettier-plugin-tailwindcss` handles it
- Do not use `any`, `@ts-ignore`, or `@ts-expect-error` to silence types
- Do not skip `bun run format` and `bun run check` after a change
- Do not invent new arbitrary Tailwind values (`p-[7px]`) before checking design tokens
- Do not change `components.json`, `svelte.config.js`, or `src/routes/layout.css` global styles
  without asking
- Do not add a new icon library — lucide is the chosen one
- Do not rewrite `tv()` variants as inline conditionals — keep the shadcn pattern

## References

- [shadcn-svelte docs](https://www.shadcn-svelte.com/) — component catalog and usage
- [shadcn-svelte CLI](https://www.shadcn-svelte.com/docs/cli) — `init`, `add`, options
- [shadcn-svelte theming](https://www.shadcn-svelte.com/docs/theming) — CSS variables, base colors
- [tailwind-variants](https://www.tailwind-variants.org/) — `tv()` API used by shadcn primitives
- [Tailwind CSS v4](https://tailwindcss.com/docs) — utility classes, theme config
- [lucide-svelte](https://lucide.dev/guide/packages/lucide-svelte) — icon usage
- [Svelte 5 snippets](https://svelte.dev/docs/svelte/snippet) — `{#snippet}` + `{@render}`
- Repo files worth referencing:
  - `components.json` — shadcn config (style, aliases, icon library)
  - `src/lib/utils.ts` — `cn`, `WithElementRef`, `WithoutChildren*` helpers
  - `src/lib/components/ui/button/button.svelte` — canonical shadcn primitive pattern
  - `src/routes/layout.css` — global Tailwind + CSS variables
