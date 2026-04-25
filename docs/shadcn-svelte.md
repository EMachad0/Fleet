## When to use

Consult this doc whenever you are:

- Creating a new `.svelte` component, page, or layout
- Modifying an existing component's styling or structure
- Importing a new shadcn-svelte component via the CLI
- Deciding whether to create a new component or extend an existing one

## Core principles

1. **Composition over styling.** Pages and layouts compose components. Components hold the Tailwind. If a page has more than a handful of utility classes, you are missing a component.
2. **Search before you create.** Existing `$lib/components/ui/*` first → shadcn registry second → new component last.
3. **No duplication.** Never copy-paste a component. Reuse from where it lives, or promote to `$lib/components/*`.
4. **TypeScript always.** Zero type errors before you consider a change done (`bun run check`).

## Critical rules

### 1. Tailwind lives in components, not pages or layouts

Pages (`+page.svelte`) are for composition — they assemble components and wire data. Push Tailwind into components. A single wrapper `<div class="container mx-auto py-8">` on a page is fine; everything inside should be components.

### 2. Component creation workflow — search, extend, create

1. Does `$lib/components/ui/*` or `$lib/components/app/*` already have it? → import and use.
2. Does shadcn-svelte's registry have it? → `bun x shadcn-svelte@latest add <name> -y -o`, then optionally wrap in a feature component.
3. Build a new component. Generic + reusable → `$lib/components/app/<kebab>/`. Feature-specific → `src/routes/<feature>/components/<kebab>/`.

Every component is a folder with `index.ts` (see `project-structure.md` rule 3a).

If uncertain which bucket it belongs in → present a short plan to the user before writing code.

### 3. shadcn CLI — always use bun, always pass `-y -o`, never pipe

```sh
bun x shadcn-svelte@latest add <name> -y -o
```

- `-y` skips the "Components to install" confirmation.
- `-o` auto-accepts "overwrite existing files?" — without it, the CLI **hangs** waiting for input.
- **Never pipe or redirect output** (`2>&1 | tail`, `| cat`, `> out.log`) — non-TTY stdout freezes the CLI's prompts.
- Don't use `npx` or `pnpm dlx` — always `bun x` (see `package-manager.md`).

Add multiple at once:

```sh
bun x shadcn-svelte@latest add dialog dropdown-menu input label -y -o
```

If you've customized a component the CLI is about to overwrite (e.g. `button.svelte`), back it up first and restore after.

**After `add`, always run:**

```sh
bun run format
bun run check
```

Config is already done — `components.json` at the repo root declares `style: "luma"`, `iconLibrary: "lucide"`, and all path aliases. Don't rerun `init` or change `components.json` without asking.

### 4. Component location

Component location rules live in `project-structure.md` (rules 3, 3a, 3b, 6). Key points:

- `ui/` is CLI territory; `app/` is yours. Never mix them.
- Every component is a folder with `index.ts` — never a flat `.svelte` file.
- No barrel `index.ts` at `components/`, `ui/`, or `app/` level.

### 5. No component duplication — ever

If you find yourself copy-pasting, either import from the existing location or promote the folder to `$lib/components/app/`. Two components differing by one class or one prop → parameterize, don't duplicate.

### 6. Always TypeScript, always zero type errors

Every component uses `<script lang="ts">`. Every prop is typed via `$props()`. Run `bun run check` before considering work done.

### 7. Keep Tailwind minimal

- Class string longer than ~80 characters → extract a sub-component or use `tailwind-variants`
- Repeating the same 5+ class combination → extract
- Arbitrary values (`p-[7px]`, `text-[#3f3f3f]`) → check if a design token exists first

### 8. Follow Svelte 5 best practices

Use `$state`, `$derived`, `$effect`, `$props`, `$bindable` — never Svelte 4 stores or `$:`. Snippets with `{@render ...}`, not slots. See `sveltekit-best-practices.md` for the full rules.

## Patterns

### Anatomy of a shadcn-derived component

After `bun x shadcn-svelte@latest add <name> -y -o`, you get a file that uses `tailwind-variants` for styling variants, forwards `class` via `cn()`, and forwards `ref`. Keep this structure when customizing — don't rip out `tv()` and replace with inline conditionals.

### Icons from lucide

```svelte
<script lang="ts">
  import Trash from '@lucide/svelte/icons/trash';
</script>

<Trash class="size-4" />
```

Don't install alternate icon packages.

## References

- [shadcn-svelte docs](https://www.shadcn-svelte.com/) — component catalog and usage
- [shadcn-svelte CLI](https://www.shadcn-svelte.com/docs/cli) — `init`, `add`, options
- [shadcn-svelte theming](https://www.shadcn-svelte.com/docs/theming) — CSS variables, base colors
- [tailwind-variants](https://www.tailwind-variants.org/) — `tv()` API used by shadcn primitives
- [Tailwind CSS v4](https://tailwindcss.com/docs) — utility classes, theme config
- [lucide-svelte](https://lucide.dev/guide/packages/lucide-svelte) — icon usage
- Repo files: `components.json`, `src/lib/utils.ts`, `src/lib/components/ui/button/button.svelte`, `src/routes/layout.css`
