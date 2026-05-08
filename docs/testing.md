## When to use

Consult this doc whenever you are:

- Writing a new test (unit or E2E)
- Adding a feature that needs test coverage
- Diagnosing a flaky test
- Deciding whether a given behavior belongs in an E2E spec or a Convex unit test
- Reviewing a PR that adds files under `tests/`, `src/convex/*.test.ts`, or changes
  `playwright.config.ts` / `vitest.config.ts`
- Setting up CI for tests

## Core principles

1. **Two layers, nothing in between.** Playwright for real-browser flows, Vitest + convex-test for
   Convex function logic. No component tests, no JSDOM, no Vitest-against-a-fake-browser.
2. **Never mock Convex.** Unit tests use `convex-test` (real in-memory Convex runtime). E2E tests
   hit `bun x convex dev`.
3. **Each test owns its data.** Fresh in-memory DB per `convexTest()`. E2E tests allocate
   uniquely-keyed fixtures per test. No shared seed user.
4. **Parallel is the default.** `fullyParallel: true` in Playwright. If a test breaks under
   parallelism, the test is wrong — do not drop workers to 1.
5. **Test what the user does, not how the code does it.** Locators use roles/labels/text, not CSS
   selectors or component internals.

## Critical Rules

### 1. Test layout — two trees, one rule each

```
fleet/
  src/
    convex/
      <entity>.ts                # the Convex function
      <entity>.test.ts           # colocated unit test (Vitest + convex-test)
      test.setup.ts              # one file, exports `modules` for convex-test
    lib/
      queries/<entity>.ts        # promoted helper (2+ consumers)
      queries/<entity>.test.ts   # its colocated unit test
    routes/
      auth/logout/+page.svelte
      auth/select-tenant/
        +page.svelte
        +page.server.ts
        +page.ts
        memberships.ts           # route-local helper
        memberships.test.ts      # its unit test (Vitest, no browser)
  tests/
    routes/
      auth/logout/
        logout.spec.ts           # mirrors src/routes
    support/
      env.ts                     # fail-fast env reader
      fixtures.ts                # Playwright fixtures
      convex.ts                  # user creation via Convex HTTP
  bunfig.toml                    # scopes `bun test` to src/convex
  playwright.config.ts
  vitest.config.ts               # include: src/**/*.test.ts
```

**Don't:**

- Put unit tests under `tests/` — colocation next to source is the rule
- Use `src/convex/__tests__/` — Vitest's glob picks up `*.test.ts` anywhere, colocation is clearer
- Put E2E specs under `src/routes/` — specs live in a sibling tree, not next to route source
- Flatten specs to `tests/<flow>.spec.ts` — the path stops telling you what the spec covers

**Why colocation for unit tests:** matches the rest of the repo (routes colocate components,
schemas). `<entity>.test.ts` next to `<entity>.ts` makes "does this have coverage?" a filename
glance.

**Why `tests/routes/…` mirrors `src/routes/…` for E2E specs:** the spec's directory tells you what
code it covers. Mirroring the route tree makes specs easy to locate from failing CI lines.

**Why `tests/` (not `e2e/`):** `.test.ts` vs `.spec.ts` already separates unit from E2E.
`tests/` reads naturally without inventing a term.

### 2. Playwright config — `fullyParallel`, shared webServer, one browser

See `playwright.config.ts`.

**Key settings:**

- `fullyParallel: true` — files AND tests within files run in parallel
- `workers: process.env.CI ? 4 : '50%'` — cap workers on CI, 50% of cores locally
- `retries: process.env.CI ? 1 : 0` — retry only on CI; locally retries hide flakiness
- `baseURL: requireEnv('PUBLIC_SITE_URL')` — no defaults; fail fast on misconfiguration
- One project: `chromium` — add firefox/webkit only if a bug demands it
- `webServer` boots `bun run dev` — Convex dev must already be running in another terminal

**Bun env-file workaround:** Bun doesn't propagate `.env*` to spawned binaries
([oven-sh/bun#23962](https://github.com/oven-sh/bun/issues/23962)). Use `--env-file` in scripts:

```json
{
  "test:e2e": "bun --env-file=.env.local run playwright test",
  "test:e2e:ui": "bun --env-file=.env.local run playwright test --ui"
}
```

Vitest doesn't need this — Vite loads `.env*` natively.

**Why one Convex deployment for all workers:** data isolation comes from unique per-test fixtures,
not separate deployments.

**Why `webServer` but no `convex` command:** Convex dev needs to stay up between runs. Run
`bun x convex dev` once, leave it up.

### 3. Vitest config — Edge runtime env, colocated tests

See `vitest.config.ts` and `src/convex/test.setup.ts`.

**Key settings:**

- `environment: 'edge-runtime'` — convex-test's mock backend runs in an Edge-runtime-shaped
  environment (Web globals, no node APIs)
- `include: ['src/**/*.test.ts']` — picks up `src/convex/**`, `src/lib/**`, and `src/routes/**`
- Alias `$lib` and `$convex` manually (Vitest doesn't run through SvelteKit's Vite plugin)

**Scripts:**

```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:e2e": "bun --env-file=.env.local run playwright test",
  "test:e2e:ui": "bun --env-file=.env.local run playwright test --ui"
}
```

**`bun test` is not supported.** Bun's native runner cannot run convex-test (missing
`import.meta.glob` support, [oven-sh/bun#6060](https://github.com/oven-sh/bun/issues/6060)).
`bunfig.toml` includes a preload script that prints a helpful error and exits 1 if you run
`bun test` by mistake. Use `bun run test` (Vitest) instead.

### 4. Parallel isolation — unique keys per test, not shared fixtures

**E2E pattern (per-test fixture):**

See `tests/support/fixtures.ts`.

Every test that needs "a user" gets its own, created via Better Auth's HTTP endpoint. No database
cleanup between tests — two tests running at once each own a disjoint `user-<random>@test.local`
account.

**Don't:**

- Share a seeded user across tests — order-dependent, fails under parallelism
- Use `test.beforeAll` + `afterAll` cleanup — collides with other tests' `beforeAll`
- Set `testConcurrency: 1` to "fix" flaky tests — the flake is a real shared-state bug
- Create fixtures through the UI — slow, brittle, and the registration flow is also under test

**Why `page` is authed by default, with `guestPage` escape hatch:** most specs exercise `/app/**`
or assume a signed-in user. Logged-out flows (login, register, guards) request `guestPage`
instead.

**Vitest pattern (free — convex-test does it for you):**

```typescript
import { convexTest } from 'convex-test';
import { test, expect } from 'vitest';
import schema from './schema';
import { modules } from './test.setup';
import { api } from './_generated/api';

test('listMyMemberships returns empty for anonymous caller', async () => {
  const t = convexTest(schema, modules);
  const result = await t.query(api.memberships.listMyMemberships, {});
  expect(result).toEqual([]);
});
```

### 5. Create E2E fixtures through Convex HTTP, never through the UI

See `tests/support/convex.ts`.

Sign users up via Better Auth's HTTP endpoint directly (the same path the UI hits). Each test's
email/slug is unique, so no cleanup is needed.

**Don't:**

- Script the registration form to create users — registration is a separate flow with its own test
- Share a pre-seeded account from `src/convex/init.ts` — violates rule 4
- Use `bun x convex import` in CI — slower, changes schema invariants

**Why hit Better Auth's HTTP endpoint:** signup must go through Better Auth (hashed credential +
session). Inserting into Convex tables by hand produces accounts that cannot log in.

### 6. Authentication in tests — API sign-in per test (E2E), `withIdentity` (Vitest)

**E2E: sign in via the context's own `request` client; the cookie jar is shared with the page.**

Playwright's `BrowserContext.request` is scoped to that context — cookies set on request responses
land in the browser's cookie jar. So a POST to `/api/auth/sign-in/email` from `ctx.request` logs
the context in, and the first `ctx.newPage()` is already authenticated.

```typescript
import { test, expect } from './support/fixtures';

test('authenticated user lands in /app', async ({ page }) => {
  await page.goto('/app');
  await expect(page.getByText(/User /)).toBeVisible();
});

test('logged-out user hitting /app is redirected', async ({ guestPage }) => {
  await guestPage.goto('/app/consumer/acme');
  await expect(guestPage).toHaveURL(/\/auth\/login/);
});
```

**Where the default `page` fixture doesn't apply:** the login spec itself tests the UI login flow,
so it uses `user` + `guestPage` and fills the form by hand.

**Vitest: use `withIdentity` for functions that read `ctx.auth`, not `authComponent.getAuthUser`.**

```typescript
test('a Convex function that reads ctx.auth.getUserIdentity()', async () => {
  const t = convexTest(schema, modules);
  const asSarah = t.withIdentity({ name: 'Sarah', subject: 'user|sarah' });
  await asSarah.mutation(api.someEntity.create, { title: 'Hi' });
});
```

**Better Auth caveat:** `authComponent.getAuthUser(ctx)` reads Better Auth component tables, which
`convex-test` doesn't mount
([get-convex/better-auth#235](https://github.com/get-convex/better-auth/issues/235)). Two options:

1. Extract post-auth logic into a pure helper and unit-test that (preferred)
2. Test the function end-to-end via Playwright

Do not `vi.mock('./auth')` — `convex-test` exists to avoid mock drift.

### 7. Locators: roles, labels, visible text — not CSS or `data-testid`

```typescript
// Good
await page.getByRole('button', { name: 'Sign in' }).click();
await page.getByLabel('Email').fill('user@example.com');
await expect(page.getByRole('heading', { name: 'Select a workspace' })).toBeVisible();
await expect(page.getByText('Invalid email or password')).toBeVisible();
```

**Don't:**

```typescript
await page.locator('#email').fill('…'); // relies on id that may change
await page.locator('button.primary').click(); // styling, not semantics
await page.locator('[data-testid="submit-btn"]').click(); // only as last resort
```

`data-testid` is a last resort — use it when the element has no accessible role and no visible
label. If you reach for it often, the component itself probably has an accessibility gap.

### 8. What belongs in which layer

| Behavior under test                                       | Layer                                    |
| --------------------------------------------------------- | ---------------------------------------- |
| User can log in with correct password and lands in /app   | E2E                                      |
| Wrong password shows specific error copy                  | E2E                                      |
| Session cookie persists across reloads                    | E2E                                      |
| User with 0 tenants sees "contact your admin"             | E2E                                      |
| User with 2 tenants sees select-tenant page               | E2E                                      |
| `listMyMemberships` returns `[]` for anonymous caller     | Unit (Vitest + convex-test)              |
| `pickDefault` picks most recently `selectedAt` membership | Unit (pure helper — no auth, no DB)      |
| `groupMembershipsByType` orders + drops empty buckets     | Unit (pure helper in `src/lib`)          |
| `selectMembership` rejects another user's membership      | Unit with `t.withIdentity`               |
| Zod schema validation edge cases                          | Unit (vitest, plain — no convex-test)    |
| Component renders correctly                               | Not tested — covered incidentally by E2E |

Anything that depends on Better Auth's component state lives in E2E. Anything that is pure logic
or Convex functions against your own tables lives in Vitest.

### 9. File naming

| Thing                  | Convention                 | Example                                  |
| ---------------------- | -------------------------- | ---------------------------------------- |
| Unit test              | `<module>.test.ts`         | `memberships.test.ts`, `auth.test.ts`    |
| E2E spec               | `<flow>.spec.ts`           | `login.spec.ts`, `select-tenant.spec.ts` |
| E2E helpers / fixtures | `tests/support/<name>.ts`  | `tests/support/fixtures.ts`              |
| Vitest helper module   | `src/convex/test.setup.ts` | fixed — convex-test expects this path    |

`.test.ts` vs `.spec.ts` is an intentional split — Playwright and Vitest each match their own
files without cross-glob collisions.

## One-time setup

```bash
# Runtime + unit testing
bun add -d vitest convex-test @edge-runtime/vm

# E2E
bun add -d @playwright/test
bun x playwright install chromium

# Scaffold
mkdir -p tests/support src/convex
touch playwright.config.ts vitest.config.ts src/convex/test.setup.ts
```

Then add `test`, `test:watch`, `test:e2e`, `test:e2e:ui` scripts per rule 3.

**Before writing the first E2E test**, confirm the two dev processes are up:

```bash
bun x convex dev      # terminal 1 — long-running
bun run dev           # terminal 2 — long-running
```

## Patterns

### Pattern: login happy path (SPA form — note `networkidle`)

```typescript
// tests/routes/auth/login/login.spec.ts
import { test, expect } from '../../../support/fixtures';

test('user can sign in with a valid password', async ({ guestPage, user }) => {
  // `guestPage`, not the default authed `page`. `{ waitUntil: 'networkidle' }` is
  // mandatory because this form is SPA mode — without hydration the click no-ops
  // or blind-POSTs to a 405.
  await guestPage.goto('/auth/login', { waitUntil: 'networkidle' });
  await guestPage.getByLabel('Email').fill(user.email);
  await guestPage.getByLabel('Password').fill(user.password);
  await guestPage.getByRole('button', { name: 'Sign in' }).click();

  await expect(guestPage).toHaveURL(/\/auth\/select-tenant/);
});
```

**Why `waitUntil: 'networkidle'`:** Any button wired with `onclick` / `bind:` only works after
hydration. Vite dev serves client chunks as separate HTTP requests; under parallel load those
requests can outlast the page's `load` event. Wait for idle before interacting with SPA-mode
forms (no server action fallback).

**You do not need `networkidle` for:** plain anchor clicks (`<a href>`), form submissions with
`use:enhance` + real server action.

### Pattern: Convex unit test with fresh in-memory DB

```typescript
// src/convex/memberships.test.ts
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import schema from './schema';
import { modules } from './test.setup';
import { api } from './_generated/api';

test('selectMembership refuses a membership that belongs to another user', async () => {
  const t = convexTest(schema, modules);

  // Seed directly via `t.run` — bypasses Better Auth on purpose; the behavior
  // under test is the authorization check, not the auth layer.
  const { otherMembershipId } = await t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      name: 'Acme',
      slug: 'acme',
      type: 'consumer',
    });
    const otherMembershipId = await ctx.db.insert('memberships', {
      userId: 'user|someone-else',
      tenantId,
      role: 'member',
    });
    return { otherMembershipId };
  });

  const asMe = t.withIdentity({ subject: 'user|me' });
  await expect(
    asMe.mutation(api.memberships.selectMembership, { membershipId: otherMembershipId }),
  ).rejects.toThrow();
});
```

## References

### Playwright

- [Parallelism](https://playwright.dev/docs/test-parallel) — `fullyParallel`, workers
- [Authentication](https://playwright.dev/docs/auth) — `storageState`, setup projects
- [Locators](https://playwright.dev/docs/locators) — `getByRole`, `getByLabel`
- [Web server](https://playwright.dev/docs/test-webserver) — `webServer` config
- [Test fixtures](https://playwright.dev/docs/test-fixtures) — how `test.extend` works

### Vitest + convex-test

- [convex-test docs](https://docs.convex.dev/testing/convex-test) — `import.meta.glob`,
  `withIdentity`, HTTP action testing
- [convex-test on GitHub](https://github.com/get-convex/convex-test) — examples, issues
- [Vitest](https://vitest.dev/) — assertions, mocking, test isolation

### Known gotchas

- [get-convex/better-auth #235](https://github.com/get-convex/better-auth/issues/235) —
  convex-test cannot mount Better Auth component's adapter tables
- [oven-sh/bun#23962](https://github.com/oven-sh/bun/issues/23962) — Bun doesn't propagate
  `.env*` to spawned binaries; use `--env-file` workaround
- [oven-sh/bun#6060](https://github.com/oven-sh/bun/issues/6060) — Bun native runner missing
  `import.meta.glob` support
