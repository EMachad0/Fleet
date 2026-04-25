## When to use

Consult this doc whenever you are:

- Adding, removing, or updating a dependency
- Following install instructions from a library's README (which almost always say `npm install …`)
- Reverting or rebasing changes that touch `package.json` or `bun.lock`
- Setting up a fresh clone or CI pipeline

## Critical rules

### 1. Bun is the ONLY package manager — never use npm, npx, pnpm, yarn, or deno

Not even "just this once". Every command below is **banned**:

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

Mixing package managers creates a second lockfile whose resolution differs from bun's — CI and teammates will see a silently different dependency tree. If a tool absolutely requires npm (rare), call it out and ask before proceeding.

### 2. Never edit `package.json` or `bun.lock` by hand

Every change goes through a bun command:

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

Bun writes `package.json` and `bun.lock` atomically. Hand-editing drifts them apart.

Don't hand-edit `bun.lock` either — delete it and `bun install` if it is truly corrupt.

### 3. Always `bun install` after anything that modifies `package.json` or `bun.lock`

After `git pull`, `git checkout`, `git rebase`, `git stash pop`, or any conflict resolution that touched deps:

```sh
bun install
```

### 4. Before committing a dep change, verify everything matches

```sh
bun install
bun run format
bun run lint
bun run check
```

### 5. Undoing a `bun add` — use `bun remove`, not `git checkout`

```sh
bun remove <name>
```

Don't use `git checkout -- package.json bun.lock` — it leaves `node_modules` stale and may wipe other legitimate dep changes from the session. This mistake previously dropped four runtime deps silently.

### 6. Use `bun x <binary>@latest` for one-shot tool invocations

```sh
bun x shadcn-svelte@latest add button -y -o
```

Pin `@latest` explicitly — omitting it uses whatever bun has cached. For project-local binaries, use `bun run <script>` or `bun <binary>` instead (don't use `bun x` for those).

### 7. `dependencies` vs `devDependencies` — pick by "does it ship?"

> **"Is this package imported by code that ships?"**
>
> - Yes (imported by `src/routes/**`, `src/lib/**`, `src/convex/**`) → `bun add <name>`
> - No (build / lint / format / type-check / scaffolders) → `bun add -D <name>`

Don't blindly follow shadcn's scaffold — it puts runtime-imported packages in `devDependencies`. If `rg "from ['\"]<pkg>['\"]" src/` matches, the package must be in `dependencies`.

Don't install transitive peer deps just to silence warnings — add them only when you use the feature that needs them.

### 8. Do not commit `node_modules`

`node_modules/` is `.gitignore`d. CI uses `bun install --frozen-lockfile`.

## References

- [Bun install docs](https://bun.sh/docs/cli/install) — `bun install` / `add` / `remove` reference
- [Bun package manager overview](https://bun.sh/docs/install/overview) — lockfile, hoisting, peer deps
- [Bun update](https://bun.sh/docs/cli/update) — version bumps, `--latest`
- [Bun pm](https://bun.sh/docs/cli/pm) — inspecting installed packages
- [Bun run vs bun x](https://bun.sh/docs/cli/run) — when to use each
