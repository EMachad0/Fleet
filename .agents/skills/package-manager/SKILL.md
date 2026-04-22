---
name: package-manager
description:
  How to manage dependencies in the fleet repo. Bun is the only package manager. Covers adding,
  removing, updating, and auditing dependencies, plus the safety rules around `package.json` and
  `bun.lock`. Use whenever installing a library, reading install instructions that mention npm /
  pnpm / yarn, or touching any dependency-related file.
metadata:
  tags: bun, dependencies, package-manager, tooling, npm, pnpm, yarn
---

## When to use

Consult this skill whenever you are:

- Adding, removing, or updating a dependency
- Following install instructions from a library's README (which almost always say `npm install …`)
- Reverting or rebasing changes that touch `package.json` or `bun.lock`
- Reviewing a PR that modifies `package.json`, `bun.lock`, or `node_modules` state
- Setting up a fresh clone or CI pipeline

**Complementary skills:**

- `project-structure` — where `package.json`, `bun.lock`, and the dependency-consuming code lives
- `shadcn-svelte` — the shadcn CLI wraps `bun add` under the hood; the same rules apply
- `superforms` — its one-time-setup step installs runtime and dev dependencies via `bun add`

## Core principles

1. **Bun is the only package manager.** This repo is committed to bun: `bun.lock` is the lockfile,
   `bun install` is how dependencies are fetched, `bun x` is how package binaries run. Nothing else
   touches `node_modules`.
2. **The CLI owns `package.json` and `bun.lock`.** You never type into these files directly. Every
   change goes through a `bun add` / `bun remove` / `bun update` / `bun install` invocation so the
   two files stay in sync and reproducible on every machine.
3. **Documentation lies — translate it.** Every library's README shows `npm install x`, `pnpm add
x`, `yarn add x`, or `deno add …`. Ignore all of them. Use `bun add x`. The package name is what
   matters; the command prefix is not.
4. **Installed ≠ declared.** A package can exist in `node_modules` without being in
   `package.json` (e.g. after a botched `git checkout`). Local commands may still work, but CI and
   fresh clones will fail. Any time you touch deps, verify the declaration.

## Critical rules

### 1. Never edit `package.json` or `bun.lock` by hand

No exceptions. Not to bump a version, not to reorder keys, not to fix a typo, not to drop a
package. Every intended change has a bun command that expresses it:

| Intent                                  | Command                              |
| --------------------------------------- | ------------------------------------ |
| Add a runtime dep                       | `bun add <name>`                     |
| Add a dev-only dep                      | `bun add -D <name>`                  |
| Add a peer dep                          | `bun add --peer <name>`              |
| Add at a specific version               | `bun add <name>@<version>`           |
| Remove a dep                            | `bun remove <name>`                  |
| Update one dep to latest (respecting ^) | `bun update <name>`                  |
| Update one dep to its newest tag        | `bun update <name> --latest`         |
| Update every dep (within ranges)        | `bun update`                         |
| Re-resolve after pulling / rebasing     | `bun install`                        |
| Install without touching the lockfile   | `bun install --frozen-lockfile` (CI) |
| Audit which version resolved            | `bun pm ls` / `bun pm ls --all`      |
| Run a package binary (once)             | `bun x <binary>@latest …`            |

**Why:** `package.json` and `bun.lock` must agree. Bun writes both atomically and resolves
transitive peers correctly. Hand-editing either file drifts them apart — exactly the mode that
silently broke the form setup in this repo (see Anti-patterns).

**Wrong:**

```jsonc
// "I'll just add this to package.json and bun install later"
"dependencies": {
  "some-lib": "^1.2.3"
}
```

**Correct:**

```sh
bun add some-lib
```

### 2. Never use npm, pnpm, yarn, deno, or any other package manager

Not even "just this once". Not even to try something a README showed. Every command below is
**banned** in this repo, regardless of what the library's docs say:

- `npm install …`, `npm i …`, `npm ci`, `npx …`
- `pnpm add …`, `pnpm install`, `pnpm dlx …`
- `yarn add …`, `yarn install`, `yarn dlx …`
- `deno add …`, `deno install …`, `deno task …`

**Translate library docs to bun:**

| Docs say                             | Use                          |
| ------------------------------------ | ---------------------------- |
| `npm install foo`                    | `bun add foo`                |
| `npm install -D foo`                 | `bun add -D foo`             |
| `npm install foo@2.3`                | `bun add foo@2.3`            |
| `pnpm add foo`                       | `bun add foo`                |
| `yarn add -D foo`                    | `bun add -D foo`             |
| `npx some-cli init`                  | `bun x some-cli@latest init` |
| `pnpm dlx some-cli`                  | `bun x some-cli@latest`      |
| `npm run <script>`                   | `bun run <script>`           |
| `node ./some-script.ts`              | `bun ./some-script.ts`       |
| `tsx ./some-script.ts` / `ts-node …` | `bun ./some-script.ts`       |

**Why:** mixing package managers creates a second lockfile (`package-lock.json`,
`pnpm-lock.yaml`, `yarn.lock`) whose hoisting and peer-dep resolution differ from bun's. Your
next teammate — or CI — will see a silently different dependency tree. Bun also runs installs
significantly faster on this repo.

If a tool absolutely requires npm (rare — Renovate, Dependabot config, etc.), call it out and
ask before proceeding. Don't silently shell out to npm.

### 3. Always `bun install` after anything that modifies `package.json` or `bun.lock`

The situations where `bun.lock` or `package.json` can change without running bun commands:

- `git pull` / `git fetch` + `git merge` on a branch that touched deps
- `git checkout <branch>` that has a different dep set
- `git checkout -- package.json bun.lock` (reverting to a committed version)
- `git rebase` / `git stash pop` bringing in dep changes
- Rebasing a PR against `main` that added packages
- Manual surgery on a conflict in either file (rare; still do it and then re-run install)

**After any of these, run:**

```sh
bun install
```

This brings `node_modules` back in sync with the lockfile and reports any drift. If the install
reports changes you did not expect — new packages appearing, old ones disappearing — stop and
investigate before moving on.

**Wrong:**

```sh
# reverted package.json but left node_modules alone
git checkout -- package.json bun.lock
bun run check   # still passes locally — node_modules still has the old packages
git commit -am "revert accidental change"
# CI: explodes. fresh clone: explodes. teammate: wastes an hour.
```

**Correct:**

```sh
git checkout -- package.json bun.lock
bun install
bun run check
```

### 4. Before committing a dep change, verify declaration + install match

Run this **three-way** check:

```sh
bun install          # lockfile and node_modules synced to package.json
bun run format       # prettier formats package.json
bun run lint         # confirms clean
bun run check        # svelte-check confirms imports resolve against declared deps
```

If any of those change `package.json` or `bun.lock` after the first command, stop — something
is off.

### 5. Undoing a `bun add` — use `bun remove`, not `git checkout`

If you added a package to test something and want to back it out, **always** use the bun CLI:

```sh
bun remove <name>
```

**Do not** do `git checkout -- package.json bun.lock` as a shortcut. That undoes `package.json`
and `bun.lock` but leaves `node_modules` with the old tree, so `bun run check` still passes
locally while a fresh install elsewhere will produce a different tree. Worse, if the branch had
other legitimate dep changes (e.g. earlier work in the same session), `git checkout` will wipe
those too. This exact mistake silently dropped four runtime deps and three dev deps from this
repo before being caught.

**Wrong:**

```sh
bun add experimental-lib
# decide you don't want it
git checkout -- package.json bun.lock   # wipes more than you intended
```

**Correct:**

```sh
bun add experimental-lib
bun remove experimental-lib
```

### 6. Use `bun x <binary>@latest` for one-shot tool invocations

For CLIs that are not project dependencies (scaffolders, ad-hoc tools):

```sh
bun x shadcn-svelte@latest add button -y -o
bun x create-svelte@latest my-app
```

Pinning `@latest` is explicit about wanting the most recent release; omitting it picks whatever
bun has cached and has been observed to stale. Use the shadcn-svelte flag rules from its skill
(`-y -o`, no piping) whenever you invoke its CLI.

For binaries that **are** project dependencies, call them via the project scripts
(`bun run <script>`) or via `bun <binary>` / `bun run <binary>` — not through `bun x`, which
would fetch a fresh copy.

### 7. `dependencies` vs `devDependencies` — pick by "does it ship?"

This is a `"private": true` SvelteKit app — nothing consumes our `package.json` downstream, Vite
bundles client + SSR output, and Convex bundles its functions independently. That means the
`dependencies` / `devDependencies` split is **mostly cosmetic for local dev and CI**, because
both sets are always installed together.

But the split still matters for: (a) readability, (b) `bun install --production` on thin
deploy targets, (c) Renovate / Dependabot rules, (d) future monorepo or library extraction.
Pick the bucket by a single question:

> **"Is this package imported by code that ships?"**
>
> - Yes (imported by `src/routes/**`, `src/lib/**`, `src/convex/**`, or any code that runs in
>   the built app, the SSR server, or a Convex function) → `bun add <name>` (goes in
>   `dependencies`).
> - No (only used by build / lint / format / type-check / scaffolders) → `bun add -D <name>`
>   (goes in `devDependencies`).

**This repo's bucketing:**

| `dependencies` (ships as runtime code)                                                                                                                                                                                                                                  | `devDependencies` (build / tooling only)                                                                                                                                                                                                                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `svelte*` runtime, `@mmailaender/convex-svelte`, `convex`, `convex-helpers`, `better-auth`, `@convex-dev/better-auth`, `sveltekit-superforms`, `sveltekit-flash-message`, `zod`, `formsnap`, `bits-ui`, `tailwind-variants`, `tailwind-merge`, `clsx`, `@lucide/svelte` | `@sveltejs/*`, `vite`, `svelte` (compiler), `svelte-check`, `typescript`, `typescript-eslint`, `eslint*`, `prettier*`, `shadcn-svelte` (CLI only), `tailwindcss`, `@tailwindcss/*` (Tailwind plugins), `tw-animate-css` (Tailwind plugin), `@types/node`, `globals`, `@fontsource-variable/*` (processed at build time via CSS `@import`) |

**Common traps to avoid:**

- **Don't blindly follow shadcn's scaffold.** shadcn-svelte's default is to stuff everything
  (bits-ui, formsnap, tailwind-variants, clsx, tailwind-merge, @lucide/svelte, etc.) into
  `devDependencies` on the theory "it all gets bundled at build time, so it's a build concern."
  That's defensible but inconsistent with the "imported by shipped code" rule above. In this
  repo we promote all of those to `dependencies` when they're actually imported. If you run
  `bun x shadcn-svelte@latest add <name>` and it adds something to `-D`, move it.
- **`@types/*` always belong in `devDependencies`.** Types are erased at build time.
- **Build plugins belong in `devDependencies`.** Tailwind plugins (`@tailwindcss/forms`,
  `@tailwindcss/typography`, `tw-animate-css`), Vite plugins, ESLint plugins — they run in the
  build pipeline and disappear after.
- **CSS-imported packages (fonts, CSS libs)** go in `devDependencies` — Vite inlines / copies
  them at build time; the files in `node_modules` aren't there at runtime.
- **Transitive peer deps you don't import directly**: don't install them just to silence peer
  warnings. Example: `bits-ui` declares `@internationalized/date` as a non-optional peer, but
  its calendar / date-picker primitives are the only consumers. If you don't use those, tree
  shaking keeps the dep out of the bundle. Tolerate the peer-warning; add it (via the shadcn
  CLI pulling the `calendar` component) only when actually needed.

**If you're unsure**, grep for the import:

```sh
rg "from ['\"]<pkg-name>['\"]" src/
```

If nothing matches but lint / build still works, the package is either transitive (leave it
alone) or build-time tooling (`-D`). If something matches in `src/`, the package must be in
`dependencies`.

### 8. Do not commit `node_modules`

`node_modules/` is `.gitignore`d. If you ever see it staged, abort the commit — something is
wrong with your git state. Do not add it "to speed up CI"; CI uses `bun install
--frozen-lockfile` against the committed `bun.lock`.

## Quick decision tree

```
Need to change a dependency?
│
├─ Adding ────────────→ bun add <name>            (runtime)
│                       bun add -D <name>         (dev / build-time / types)
│                       bun add --peer <name>     (peer)
│
├─ Removing ──────────→ bun remove <name>
│
├─ Updating one ──────→ bun update <name>         (respect ^ in package.json)
│                       bun update <name> --latest (bump to newest tag)
│
├─ Updating all ──────→ bun update                (all, within declared ranges)
│
├─ Reverting a change─→ bun remove <name>          NOT git checkout
│
└─ Post-pull / merge─→ bun install                 then bun run check

Docs tell you to use npm/pnpm/yarn/deno?
└─ Ignore the command prefix. Take the package name. Run bun add <name>.

Something in package.json looks wrong?
└─ Do not edit the file. Reproduce via a bun command, or ask before hand-editing.
```

## Anti-patterns

- **Hand-editing `package.json`.** Even for a "trivial" version bump. Use `bun add <name>@<v>`.
- **Hand-editing `bun.lock`.** Delete it and `bun install` if it is truly corrupt; never patch.
- **Running `npm install`, `pnpm install`, or `yarn install`.** Produces a second lockfile and a
  divergent dependency tree. Remove any such lockfile immediately.
- **Copying `npx foo` commands from docs verbatim.** Translate to `bun x foo@latest`.
- **`git checkout -- package.json bun.lock`** to undo an experiment — use `bun remove`.
- **Committing after `bun remove` without running `bun install`.** The two commands together
  keep the lockfile and `node_modules` coherent; skipping install can leave `node_modules`
  stale.
- **Adding a dependency "only to types" to `dependencies` instead of `devDependencies`.**
  Build-time tools (`@types/*`, `prettier`, `eslint`, test runners, type-only packages used
  only at compile time) belong in `-D`.
- **Leaving a runtime-imported package in `devDependencies` because that's where the scaffold
  put it.** If `rg "from ['\"]<pkg>['\"]" src/` matches, it must be in `dependencies`. Move it
  with `bun remove <pkg> && bun add <pkg>`.
- **Installing a non-optional peer dep just to silence a warning**. If nothing in your code
  imports it (directly or via a component that needs it), skip it. Bun will warn; that's OK.
  Adding the actual feature (e.g. shadcn `calendar` → brings `@internationalized/date`) is
  what pulls in the peer when the time comes.
- **Relying on `node_modules` presence as proof a package is installed.** It proves nothing —
  bun does not prune aggressively. Check `package.json` or run `bun pm ls <name>`.
- **Using `bun x` to run a project-local binary.** Use `bun run` or `bun <binary>` — `bun x`
  fetches a fresh copy and is slower.
- **Silencing a failed `bun install` with `git checkout`.** Fix the underlying conflict or
  dependency issue. Reverting hides it.

## References

- [Bun install docs](https://bun.sh/docs/cli/install) — full `bun install` / `add` / `remove`
  reference
- [Bun package manager overview](https://bun.sh/docs/install/overview) — lockfile behavior,
  hoisting, peer deps
- [Bun update](https://bun.sh/docs/cli/update) — version bumps, `--latest`
- [Bun pm](https://bun.sh/docs/cli/pm) — inspecting installed packages
- [Bun run vs bun x](https://bun.sh/docs/cli/run) — when to use each
