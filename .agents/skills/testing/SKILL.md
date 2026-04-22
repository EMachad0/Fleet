---
name: testing
description:
  How we test the fleet app. Two layers — Playwright for end-to-end user flows against a real dev
  Convex deployment, Vitest + convex-test for Convex function unit tests against an in-memory
  runtime. No Convex mocking, no shared test state, parallel-by-default. Use when writing new
  tests, adding a test infra, debugging flaky tests, or reviewing a PR that touches `tests/` or
  `*.test.ts`.
metadata:
  tags: testing, playwright, vitest, convex-test, e2e, unit-tests
---

## When to use

Consult this skill whenever you are:

- Writing a new test (unit or E2E)
- Adding a feature that needs test coverage
- Diagnosing a flaky test
- Deciding whether a given behavior belongs in an E2E spec or a Convex unit test
- Reviewing a PR that adds files under `tests/`, `src/convex/*.test.ts`, or changes
  `playwright.config.ts` / `vitest.config.ts`
- Setting up CI for tests

**Complementary skills:**

- `project-structure` — where source files live; tests mirror those rules
- `sveltekit-best-practices` — the patterns E2E tests are verifying
- `superforms` — form flows are what E2E tests exercise most
- `package-manager` — installing test deps goes through `bun add -d`, not npm

## Core principles

1. **Two layers, nothing in between.** Playwright for real-browser flows, Vitest + convex-test for
   Convex function logic. No component tests, no JSDOM, no Vitest-against-a-fake-browser. Every
   thing a user can do gets an E2E test; every non-trivial branch in a Convex function gets a unit
   test.
2. **Never mock Convex.** Unit tests use `convex-test`, which ships a real in-memory Convex runtime
   — same query engine, same transaction semantics, same validators. E2E tests hit the actual
   `bunx convex dev` deployment. Mocking Convex would test the mock, not the code.
3. **Each test owns its data.** Unit tests get a fresh in-memory DB per `convexTest()` call. E2E
   tests allocate uniquely-keyed fixtures (email / tenant slug) per test. No shared seed user, no
   "first test creates the org". Isolation is what makes parallel workers safe.
4. **Parallel is the default.** `fullyParallel: true` in Playwright, and convex-test is inherently
   parallel-safe (separate in-memory DBs per test). If a test breaks under parallelism, the test is
   wrong — do not drop workers to 1.
5. **Test what the user does, not how the code does it.** Locators use roles / labels / visible
   text, not CSS selectors or component internals. Convex tests call the exported query/mutation,
   not internal helpers.

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
      queries/<entity>.ts        # promoted helper (2+ consumers, per project-structure rule 6)
      queries/<entity>.test.ts   # its colocated unit test
    routes/
      auth/logout/+page.svelte   # the page …
      auth/select-tenant/
        +page.svelte             # the page …
        +page.ts                 # … its universal loader (convexLoad for live data)
        +page.server.ts          # … its server-only loader (redirect guard)
        memberships.ts           # … route-local presentation helper (single consumer)
        memberships.test.ts      # … and its unit test (Vitest, no convex-test, no browser)
  tests/
    routes/
      auth/logout/
        logout.spec.ts           # … and the spec that exercises it (mirrors src/routes)
    support/
      env.ts                     # fail-fast env reader (PUBLIC_SITE_URL, etc.)
      fixtures.ts                # Playwright fixtures (user, page, guestPage)
      convex.ts                  # helpers that create users via Convex HTTP
  bunfig.toml                    # scopes `bun test` to src/convex (see rule 3)
  playwright.config.ts
  vitest.config.ts               # include: src/**/*.test.ts — picks up convex/, lib/, AND routes/
```

**Why colocation for unit tests:** matches the rest of the repo (routes colocate components,
schemas; Convex files live next to the entity they own). `<entity>.test.ts` next to `<entity>.ts`
makes "does this have coverage?" a filename glance instead of a grep.

**Why `tests/routes/…` mirrors `src/routes/…` for E2E specs:** a spec's directory tells you what
code it covers without reading the file. Changing `src/routes/auth/logout/+page.svelte` should be
an obvious "also update `tests/routes/auth/logout/logout.spec.ts`" — and vice versa. A flat
`tests/login.spec.ts` at the top level scales poorly once the app has twenty flows and moves the
cost to grep. Mirroring the route tree also makes the spec easy to locate from a failing CI line:
the path is the route.

**How to file a spec that touches multiple routes:** put it under the route where the user-facing
value lands. A "consumer onboarding" spec that walks through `/auth/register` → `/auth/select-tenant`
→ `/app/consumer/[slug]` belongs at `tests/routes/app/consumer/onboarding.spec.ts`, because the
value — and the assertion — is "consumer arrives in their workspace". The setup steps are
incidental; the outcome is what the spec is named for.

**Why `tests/` (not `e2e/`):** `.test.ts` vs `.spec.ts` (see rule 9) is already the signal that
separates unit from E2E — Playwright's `testMatch` picks up `.spec.ts`, Vitest's `include` picks
up `.test.ts`, and neither folder name changes that. `tests/` reads naturally ("the tests folder
holds E2E tests; unit tests live next to the code they test") without inventing a term the
onboarding reader has to learn.

**Wrong:**

- Putting unit tests under `tests/` too — colocation next to the source file is the rule (matches
  how schemas, components, and load functions are organized elsewhere)
- `src/convex/__tests__/<entity>.test.ts` — the `__tests__` folder convention is Jest-era; Vitest's
  glob picks up `*.test.ts` anywhere, and colocation is clearer
- E2E tests under `src/routes/<feature>/` — the spec lives in a sibling tree, not next to the
  route source, so SvelteKit's route compiler never sees `.spec.ts` files
- Flat `tests/<flow>.spec.ts` with all specs at the top level — the path stops telling you what
  the spec covers as soon as the suite grows past a handful of files
- A `vitest-setup-client.ts` or `@vitest/browser` — we do not run component tests. If you need to
  test a Svelte component in isolation, reach for Playwright instead (it's already there and
  renders with the real stack)

### 2. Playwright config — `fullyParallel`, shared webServer, one browser

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';
import { requireEnv } from './tests/support/env';

// Fail fast if `PUBLIC_SITE_URL` is missing. No `?? 'http://localhost:5173'`
// default — silent defaults are how you run a full suite against the wrong
// origin and don't notice.
const baseURL = requireEnv('PUBLIC_SITE_URL');

export default defineConfig({
  testDir: 'tests',
  // Every spec is independent — see rule 4. Files run in parallel (default) AND tests within a
  // file run in parallel. Tests that *must* serialize opt in via `test.describe.serial`.
  fullyParallel: true,
  // On CI we cap workers for deterministic shard timing. Locally: 50% of cores keeps the dev
  // server responsive while Playwright runs. Bump or lower based on your machine.
  workers: process.env.CI ? 4 : '50%',
  // Retry only on CI. Retries locally hide flakiness instead of surfacing it.
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',

  use: {
    baseURL,
    // Trace on first retry keeps local runs fast while still giving us a post-mortem on CI.
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Add firefox / webkit only if a bug actually demands cross-browser coverage. Each extra
    // project multiplies total runtime. Chromium catches ~95% of our real issues.
  ],

  // Boot `bun run dev` for the test run. Convex dev (`bunx convex dev`) must already be running
  // in another terminal — Playwright does not manage it, because a single shared Convex
  // deployment is what all workers hit.
  webServer: {
    command: 'bun run dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
```

**Why no URL defaults anywhere (`baseURL`, Convex HTTP URL, origin header):** a default that looks
right on a dev laptop is the exact wrong thing in CI or on a teammate's machine with a different
port. `requireEnv` throws with a message that names the variable and points at `.env.example`, so
misconfiguration surfaces on test start — not halfway through a green-looking suite that was
actually talking to nothing.

**Load `.env.local` via `bun --env-file`, not from Playwright's config.** Bun loads `.env*` into
its own runtime but **does not** propagate those variables to binaries spawned by `bun run` /
`bunx` — this is a known, still-open upstream bug
([oven-sh/bun#23962](https://github.com/oven-sh/bun/issues/23962), reported 2025-10-22). A
comment on that issue explains why:

> From digging around in the related code, it appears bun special cases package.json scripts, and
> skips loading env vars. This is to help handle the situation where the package.json script is
> another call to bun, which might have a conflicting `NODE_ENV` set.

Bun's own docs point at `--env-file` as the blessed workaround for package.json scripts
(https://bun.sh/docs/runtime/env, "Manually specifying `.env` files"):

> You can use `--env-file` when running scripts in bun's runtime, or when running package.json
> scripts.

Encode it directly in the script — `bun run <name>` falls through from scripts to
`node_modules/.bin/<name>` when no matching script exists, so the single line below loads the env
file _and_ spawns `playwright` with it populated:

```json
// package.json "scripts"
{
  "test:e2e": "bun --env-file=.env.local run playwright test",
  "test:e2e:ui": "bun --env-file=.env.local run playwright test --ui"
}
```

Vitest doesn't need this: Vitest loads `.env*` via Vite, which has its own dotenv handling, so
`bun run test` works without a wrapper.

Once upstream #23962 is fixed, this collapses back to `"test:e2e": "playwright test"`.

**Why one Convex deployment for all workers:** Convex's dev deployment is already a network
service; booting one per worker is minutes of overhead per run and buys nothing — the test data
isolation comes from unique per-test fixtures (rule 4), not from separate deployments.

**Why `webServer` but not a `convex` command there:** `webServer` restarts on every Playwright run
and waits for readiness. Convex dev needs to stay up between runs (it owns the database state you
iterate on during development); coupling its lifecycle to Playwright's makes the edit-test loop
painful. Run `bunx convex dev` once, leave it up.

### 3. Vitest config — Edge runtime env, colocated tests

```typescript
// vitest.config.ts
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // SvelteKit sets up `$lib` / `$convex` via its Vite plugin at dev/build
  // time; Vitest doesn't run through that plugin (no reason to pay for
  // `.svelte` compilation we never load in unit tests), so mirror the two
  // aliases by hand. Keep in sync with `svelte.config.js`.
  resolve: {
    alias: {
      $lib: path.resolve('./src/lib'),
      $convex: path.resolve('./src/convex'),
    },
  },
  test: {
    // convex-test's mock backend runs the same code Convex's cloud runtime does, which is an
    // Edge-runtime-shaped environment (Web globals, no node APIs). `@edge-runtime/vm` emulates
    // that inside Vitest, so imports like `crypto.subtle`, `fetch`, and `Request` behave the way
    // they do in production. Pure-TS helpers don't care about the environment, so running them
    // under edge-runtime costs us nothing.
    environment: 'edge-runtime',
    server: { deps: { inline: ['convex-test'] } },
    // Two kinds of unit tests: `src/convex/**` (convex-test) and pure-TS helpers colocated
    // with their consumer (today route-local under `src/routes/**`, promoted to
    // `src/lib/queries/**` on 2nd use — see project-structure rule 6). `tests/**/*.spec.ts`
    // are Playwright, not Vitest.
    include: ['src/**/*.test.ts'],
    // Vitest pools tests across workers by default; convex-test's fresh-DB-per-test pattern is
    // parallel-safe, so we don't override this.
  },
});
```

```typescript
// src/convex/test.setup.ts
/// <reference types="vite/client" />

// `import.meta.glob` is evaluated against the *test file's own directory*, so
// this helper lives alongside the Convex files and every test imports `modules`
// from here. Do not inline `import.meta.glob` in each test — the glob path
// becomes wrong the moment a test moves one directory up.
export const modules = import.meta.glob('./**/!(*.*.*)*.*s');
```

Add scripts:

```json
// package.json "scripts"
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:e2e": "bun --env-file=.env.local run playwright test",
  "test:e2e:ui": "bun --env-file=.env.local run playwright test --ui"
}
```

**`bun test` (the native runner) is not our path — scope it in `bunfig.toml` so it fails
cleanly.** Bun ships a Jest-compatible test runner with the `bun test` subcommand. It looks
tempting (one binary, no Vitest dep) but it cannot run our Convex suites, because `convex-test`
relies on `import.meta.glob` — a Vite transform that Bun has not implemented
([oven-sh/bun#6060](https://github.com/oven-sh/bun/issues/6060),
[get-convex/convex-test#9](https://github.com/get-convex/convex-test/issues/9)). It _also_ won't
run our Playwright specs, because `.spec.ts` files import from `@playwright/test`, not
`bun:test`. Left alone, `bun test` walks the whole repo, picks up `tests/**/*.spec.ts`, and
errors confusingly inside the first imported fixture.

Fix it with a one-line `bunfig.toml` scoping the native runner to `src/convex`:

```toml
# bunfig.toml
[test]
root = "src/convex"
```

With that in place, `bun test` only discovers files under `src/convex/**`. Until the upstream
`import.meta.glob` lands, the scope stays empty and the runner reports _"No tests found"_ with
exit 1 — a clear signal, not a crash. The canonical test commands remain `bun run test`
(Vitest/convex-test) and `bun run test:e2e` (Playwright).

There is a second, unrelated env-loading quirk worth knowing about: `bun test` itself also
doesn't auto-load `.env.local` ([oven-sh/bun#19542](https://github.com/oven-sh/bun/issues/19542),
open), which is why `--env-file=.env.local` would be needed if we ever add a bun-native suite.
Vitest dodges this entirely via Vite's own dotenv pipeline.

### 4. Parallel isolation — unique keys per test, not shared fixtures

Both layers achieve the "tests can run in any order, at any concurrency" property the same way:
**every test allocates its own uniquely-keyed data**. Do not try to be clever about cleanup.

**E2E pattern (recommended — per-test fixture):**

```typescript
// tests/support/fixtures.ts
import { test as base, expect, type Page } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { createUser, type TestUser } from './convex';
import { requireEnv } from './env';

type Fixtures = {
  user: TestUser;
  page: Page; // overrides Playwright's built-in `page` with an authenticated one
  guestPage: Page; // fresh, cookie-less page for logged-out flows
};

/**
 * Every test that needs "a user" gets its own, created via Better Auth's HTTP
 * endpoint (the same one the app uses). No database cleanup between tests:
 * two tests running at once each own a disjoint `user-<random>@test.local`
 * account, so they cannot race. Creation is ~150 ms. See rule 6 for the
 * authenticated-page fixture that builds on this.
 *
 * The inline `// eslint-disable-next-line no-empty-pattern` above `user` is
 * required: Playwright parses the fixture's first argument via
 * `Function.prototype.toString()` and rejects anything that is not an object
 * destructure (`"First argument must use the object destructuring pattern"`),
 * so `({}, use) => …` is the only legal zero-dep form. The rule is disabled
 * here and only here — no repo-wide ESLint override.
 */
export const test = base.extend<Fixtures>({
  // eslint-disable-next-line no-empty-pattern
  user: async ({}, use) => {
    const id = randomBytes(8).toString('hex');
    const user = await createUser({
      email: `user-${id}@test.local`,
      password: `pw-${id}`,
      name: `User ${id}`,
    });
    await use(user);
    // Intentionally no cleanup: `bun run clear` between full runs is enough
    // and keeps the per-test path simple.
  },

  page: async ({ browser, user }, use) => {
    // See rule 6 for why sign-in goes through `ctx.request` instead of the UI
    // or a `storageState` file.
    const ctx = await browser.newContext();
    const res = await ctx.request.post('/api/auth/sign-in/email', {
      data: { email: user.email, password: user.password },
      // `ctx.request` is a programmatic HTTP client, not a browser — it does
      // not add an `Origin` header automatically, and Better Auth's
      // `trustedOrigins` check rejects the request without one.
      headers: { origin: requireEnv('PUBLIC_SITE_URL') },
    });
    if (!res.ok()) {
      throw new Error(`fixture sign-in failed (${res.status()}): ${await res.text()}`);
    }
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },

  guestPage: async ({ browser }, use) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },
});

export { expect };
```

**Why `page` is authed by default, with a named `guestPage` escape hatch:** the vast majority of
specs exercise `/app/**` or otherwise assume a signed-in user — making that the default keeps
every authed spec down to `async ({ page }) => …`. Specs that test the logged-out path (login,
register, guards redirecting anonymous callers, public marketing pages) request `guestPage`
instead. Each spec is explicit about which auth state it needs; neither is inferred from a
`describe` block or a top-level `beforeAll`.

**Vitest pattern (free — convex-test does it for you):**

```typescript
// src/convex/memberships.test.ts
import { convexTest } from 'convex-test';
import { test, expect } from 'vitest';
import schema from './schema';
import { modules } from './test.setup';
import { api } from './_generated/api';

test('listMyMemberships returns empty for anonymous caller', async () => {
  // Fresh in-memory DB for this test only. Any other test running in parallel
  // has its own `t` — no flags, no coordination.
  const t = convexTest(schema, modules);

  const result = await t.query(api.memberships.listMyMemberships, {});
  expect(result).toEqual([]);
});
```

**Wrong:**

- A single seeded user that all E2E tests log in as → order-dependent, fails under parallelism the
  moment any test mutates the tenant list
- `test.beforeAll` that creates data + `afterAll` that deletes it → collides with other tests'
  `beforeAll` running at the same time against the same Convex deployment
- `vi.setConfig({ testConcurrency: 1 })` to "fix" flaky unit tests → the flake is always a real
  shared-state bug; find it
- Creating fixtures through the UI (`page.goto('/auth/register')` + fill + submit) → slow, brittle,
  and the registration flow is usually also under test

### 5. Create E2E fixtures through Convex, never through the UI

```typescript
// tests/support/convex.ts
import { requireEnv } from './env';

/**
 * Admin-channel fixture creation: sign users up via Better Auth's HTTP endpoint
 * directly. This is the same path the UI hits — we're just skipping the form.
 * No cleanup is needed because each test's email/slug is unique (rule 4).
 *
 * Why not `bunx convex run init`? That script seeds dev fixtures; its data is
 * shared across tests by design (see `src/convex/init.ts`). E2E tests need
 * *per-test* data, which is a different job.
 */
const CONVEX_SITE_URL = requireEnv('PUBLIC_CONVEX_SITE_URL');
const SITE_ORIGIN = requireEnv('PUBLIC_SITE_URL');

export type TestUser = { email: string; password: string; name: string };

export async function createUser(user: TestUser): Promise<TestUser> {
  const res = await fetch(`${CONVEX_SITE_URL}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      // Better Auth enforces `trustedOrigins` on every write endpoint;
      // without an `Origin` header it replies 403 MISSING_OR_NULL_ORIGIN.
      // A real browser sets this for free — `fetch()` from Node does not.
      origin: SITE_ORIGIN,
    },
    body: JSON.stringify(user),
  });
  if (!res.ok) {
    throw new Error(`createUser failed (${res.status}): ${await res.text()}`);
  }
  return user;
}
```

**Why hit Better Auth's HTTP endpoint and not a Convex mutation directly:** signup has to go
through Better Auth (hashed credential + account row + session bookkeeping), which only happens
via its HTTP route. Inserting into Convex tables by hand produces accounts that cannot log in.

**Wrong:**

- Scripting the registration form (`/auth/register`) to create users → registration is a separate
  flow that will have its own test and may change UI
- Sharing a pre-seeded `SEED_USERS` account from `src/convex/init.ts` → see rule 4
- Going through `bunx convex import` in CI → slower, and changes the deployment's schema
  invariants you were trying to hold constant

### 6. Authentication in tests — API sign-in per test (E2E), `withIdentity` (Vitest)

**E2E: sign in via the context's own `request` client; the cookie jar is shared with the page.**

Playwright's `BrowserContext.request` is an HTTP client scoped to that context — any cookie the
server sets on a request response lands in the same cookie jar the browser uses for page
navigation. So a POST to `/api/auth/sign-in/email` from `ctx.request` logs the context in, and
the first `ctx.newPage()` we open from it is already authenticated. No UI form, no file on disk,
no shared state between tests. This is what the default `page` fixture (overridden in rule 4)
returns.

```typescript
// Usage — rule 4 defines the fixture; specs just request it.
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

**Alternatives evaluated and rejected:**

| Option                                                        | Why not                                                                                                                                                                                                                                        |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storageState` file saved by a `setup` project, reused by all | Shares a user across tests (violates rule 4). The file ages under you — session expiry or an auth-cookie schema change mid-run produces a confusing mass failure. And it adds a setup project to the config for a problem we don't need solved |
| In-memory `ctx.storageState()` once per `describe`            | Better — no disk — but still shares a user across every test in the file, and the `beforeAll` / `afterAll` ceremony is more code than the fixture above                                                                                        |
| API sign-in + `ctx.addCookies([{ name: …, domain: … }])`      | Works, but we'd have to hand-maintain Better Auth's cookie name, domain, path, and `__Secure-` prefix. Letting the server set the cookie through `ctx.request` means the test knows nothing about cookie internals                             |
| Log in via the UI in every test                               | 1-2 seconds per test of pure typing + waiting. Becomes the bottleneck of the suite                                                                                                                                                             |

The winning option pays the honest cost of per-test isolation (one `createUser` + one
`signIn.email` HTTP call, ~200 ms total) and trades nothing for speed.

**Where the default `page` fixture doesn't apply:** the login spec itself tests the UI login
flow, so it uses `user` + `guestPage` and fills the form by hand. Don't use the authed `page` to
test login — that would just test the fixture.

**Vitest: use `withIdentity` only for functions that go through `ctx.auth`, not for functions that
go through `authComponent.getAuthUser`.**

```typescript
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import schema from './schema';
import { modules } from './test.setup';
import { api } from './_generated/api';

test('a Convex function that reads ctx.auth.getUserIdentity()', async () => {
  const t = convexTest(schema, modules);
  const asSarah = t.withIdentity({ name: 'Sarah', subject: 'user|sarah' });
  await asSarah.mutation(api.someEntity.create, { title: 'Hi' });
  // …
});
```

**The Better Auth caveat.** Functions like `memberships.getCurrentMembership` call
`authComponent.getAuthUser(ctx)` — that helper reads the Better Auth component's internal tables,
which `convex-test` does not mount (see
[get-convex/better-auth#235](https://github.com/get-convex/better-auth/issues/235)).
`t.withIdentity` gives you a `ctx.auth.getUserIdentity()` subject, but not a Better Auth user row.
Two options, in order of preference:

1. **Extract the post-auth logic into a pure helper and unit-test that.** `pickDefault` in
   `src/convex/auth.ts` is the canonical example — it takes memberships and returns a choice,
   with no auth dependency. Unit-test helpers stay trivial; auth integration is covered by E2E.
2. **Test the function end-to-end via Playwright.** Anything that combines "real Better Auth
   identity" + "your logic" is a flow; push it to `tests/`. Fighting `convex-test` to mount the
   Better Auth component is unnecessary complexity when Playwright already covers this path.

Do not `vi.mock('./auth')` — the whole point of `convex-test` is to avoid mock drift.

### 7. Locators: roles, labels, visible text — not CSS or `data-testid` unless forced

```typescript
// Good — mirrors how a user (or screen reader) finds the control.
await page.getByRole('button', { name: 'Sign in' }).click();
await page.getByLabel('Email').fill('user@example.com');
await expect(page.getByRole('heading', { name: 'Select a workspace' })).toBeVisible();

// Also good — visible text assertion for non-interactive copy.
await expect(page.getByText('Invalid email or password')).toBeVisible();
```

**Wrong:**

```typescript
await page.locator('#email').fill('…'); // relies on an id that may change
await page.locator('button.primary').click(); // styling, not semantics
await page.locator('[data-testid="submit-btn"]').click(); // only if role/label is impossible
```

`data-testid` is a last resort — use it when the element has no accessible role and no visible
label (e.g., a purely decorative icon trigger). If you reach for it more than a few times per
spec, the component itself probably has an accessibility gap worth fixing.

### 8. What belongs in which layer

| Behavior under test                                           | Layer                                                                                   |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| "User can log in with correct password and lands in /app"     | E2E                                                                                     |
| "Wrong password shows specific error copy"                    | E2E                                                                                     |
| "Session cookie persists across reloads"                      | E2E                                                                                     |
| "User with 0 tenants sees 'contact your admin'"               | E2E                                                                                     |
| "User with 2 tenants sees select-tenant page"                 | E2E                                                                                     |
| `listMyMemberships` returns `[]` for anonymous caller         | Unit (Vitest + convex-test)                                                             |
| `pickDefault` picks the most recently `selectedAt` membership | Unit (pure helper — no auth, no DB)                                                     |
| `groupMembershipsByType` orders + drops empty buckets         | Unit (pure helper in `src/lib` — no browser, no Convex)                                 |
| `selectMembership` rejects another user's membership          | Unit with `t.withIdentity`, seeded membership row (NOT through `authComponent` helpers) |
| Zod schema (`loginSchema`) validation edge cases              | Unit (vitest, plain — no convex-test needed)                                            |
| Component renders correctly                                   | Not tested in isolation — covered incidentally by E2E                                   |

Anything that depends on Better Auth's component state lives in E2E. Anything that is pure logic
or Convex functions against your own tables lives in Vitest.

### 9. File naming

| Thing                  | Convention                 | Example                                    |
| ---------------------- | -------------------------- | ------------------------------------------ |
| Unit test              | `<module>.test.ts`         | `memberships.test.ts`, `auth.test.ts`      |
| E2E spec               | `<flow>.spec.ts`           | `login.spec.ts`, `select-tenant.spec.ts`   |
| E2E helpers / fixtures | `tests/support/<name>.ts`  | `tests/support/fixtures.ts`                |
| Vitest helper module   | `src/convex/test.setup.ts` | fixed — convex-test expects this glob path |

`.test.ts` vs `.spec.ts` is an intentional split: it lets Playwright and Vitest each match their
own files without cross-glob collisions.

## One-time setup

Run once when bootstrapping tests in a new clone.

```bash
# Runtime + unit testing
bun add -d vitest convex-test @edge-runtime/vm

# E2E
bun add -d @playwright/test
bunx playwright install chromium  # installs just the browser we project, not all three

# Scaffold
mkdir -p tests/support src/convex
touch playwright.config.ts vitest.config.ts src/convex/test.setup.ts
```

Then add `test`, `test:watch`, `test:e2e`, `test:e2e:ui` scripts per rule 3. Keep `convex-test`
pinned closely — its API is still pre-1.0 and moves with Convex itself.

**Before writing the first E2E test**, confirm the two dev processes are up:

```bash
bunx convex dev      # terminal 1 — long-running
bun run dev          # terminal 2 — long-running (Playwright will reuse this if --webServer fires)
```

## Patterns

### Pattern: login happy path (SPA form — note `networkidle`)

```typescript
// tests/routes/auth/login/login.spec.ts
import { test, expect } from '../../../support/fixtures';

test('user can sign in with a valid password', async ({ guestPage, user }) => {
  // `guestPage`, not the default authed `page` — the authed context would
  // already be past the form. `{ waitUntil: 'networkidle' }` is mandatory
  // because this form is SPA mode (see rule 7). Skip it and the click
  // either no-ops or blind-POSTs to a 405.
  await guestPage.goto('/auth/login', { waitUntil: 'networkidle' });
  await guestPage.getByLabel('Email').fill(user.email);
  await guestPage.getByLabel('Password').fill(user.password);
  await guestPage.getByRole('button', { name: 'Sign in' }).click();

  // Fresh fixture user has zero memberships → entry resolver sends them
  // to select-tenant.
  await expect(guestPage).toHaveURL(/\/auth\/select-tenant/);
});
```

### Pattern: wrong password surfaces Better Auth's exact message

```typescript
// tests/routes/auth/login/login.spec.ts
test('wrong password shows "Invalid email or password"', async ({ guestPage, user }) => {
  await guestPage.goto('/auth/login', { waitUntil: 'networkidle' });
  await guestPage.getByLabel('Email').fill(user.email);
  await guestPage.getByLabel('Password').fill('definitely-not-the-password');
  await guestPage.getByRole('button', { name: 'Sign in' }).click();

  // The exact Better Auth copy. If this regresses we'll see the generic
  // "We couldn't sign you in right now" — the proxy-error bug we hit
  // previously in `api/auth/[...path]/+server.ts`.
  await expect(guestPage.getByText('Invalid email or password')).toBeVisible();
  await expect(guestPage).toHaveURL(/\/auth\/login/);
});
```

### Pattern: assert a submit made no network call

When a form should short-circuit client-side (Zod validation blocks the submit, or SPA mode
should never POST to the route), subscribe to `request` **before** navigation and assert the
collected array is empty after the flow settles. "Settled" is the visible error, or the expected
URL change — anything that guarantees a would-be request has had its chance to fire.

```typescript
test('empty fields block the sign-in HTTP call entirely', async ({ guestPage }) => {
  const signInCalls: string[] = [];
  guestPage.on('request', (req) => {
    if (req.url().includes('/api/auth/sign-in/email')) signInCalls.push(req.url());
  });

  await guestPage.goto('/auth/login', { waitUntil: 'networkidle' });
  await guestPage.getByRole('button', { name: 'Sign in' }).click();

  // Synchronization point: once Zod's error is visible, the sign-in call
  // either fired or it didn't — we're not racing a pending fetch.
  await expect(guestPage.getByText('Enter a valid email')).toBeVisible();
  expect(signInCalls).toEqual([]);
});
```

Same shape for the SPA-mode assertion — the filter just narrows to `POST` against the route's
own path:

```typescript
guestPage.on('request', (req) => {
  if (req.method() === 'POST' && new URL(req.url()).pathname === '/auth/login') {
    routePosts.push(req.url());
  }
});
```

### Pattern: Convex unit test with fresh in-memory DB

```typescript
// src/convex/memberships.test.ts
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import schema from './schema';
import { modules } from './test.setup';
import { api } from './_generated/api';

test('listMyMemberships returns [] when caller is anonymous', async () => {
  const t = convexTest(schema, modules);
  expect(await t.query(api.memberships.listMyMemberships, {})).toEqual([]);
});

test('selectMembership refuses a membership that belongs to another user', async () => {
  const t = convexTest(schema, modules);

  // Seed directly via `t.run` — this bypasses Better Auth on purpose; the
  // behavior under test is the *authorization check*, not the auth layer.
  const { tenantId, otherMembershipId } = await t.run(async (ctx) => {
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
    return { tenantId, otherMembershipId };
  });

  const asMe = t.withIdentity({ subject: 'user|me' });
  // Expected to throw — but see the Better Auth caveat in rule 6. If the
  // function calls `authComponent.getAuthUser(ctx)` directly, this test
  // belongs at the E2E layer instead.
  await expect(
    asMe.mutation(api.memberships.selectMembership, { membershipId: otherMembershipId }),
  ).rejects.toThrow();
});
```

### Pattern: pure-helper unit test (no Convex needed)

```typescript
// src/convex/auth.test.ts
import { expect, test } from 'vitest';
import { pickDefault } from './auth'; // exported as a named helper for testability

test('picks the most-recently-selected membership', () => {
  const m1 = { tenantId: 'a' as const, selectedAt: 100 };
  const m2 = { tenantId: 'b' as const, selectedAt: 200 };
  const m3 = { tenantId: 'c' as const };
  expect(pickDefault([m1, m2, m3])).toBe(m2);
});

test('returns the only membership when none has been selected', () => {
  const m = { tenantId: 'a' as const };
  expect(pickDefault([m])).toBe(m);
});

test('returns null when multiple memberships exist and none has been selected', () => {
  expect(pickDefault([{ tenantId: 'a' as const }, { tenantId: 'b' as const }])).toBeNull();
});
```

(If `pickDefault` is currently file-private, promote it to a named export. "Testable" is a valid
reason to export; the helper has no sensitive surface.)

### Pattern: unit-test the pure helper that shapes a `convexLoad` result

Pages that SSR-seed Convex data with `convexLoad` typically pair the live query result with a
pure helper that groups, sorts, or derives state for the view (see `sveltekit-best-practices`
for the load-file architecture; `project-structure` rule 6 for where the helper lives). The
helper is the most valuable thing to unit-test here: ordering invariants, empty-bucket
dropping, and similar pure logic don't need a browser or a Convex round-trip to verify.

**Test the helper, not the load function.** Load functions are covered incidentally by E2E
(the page either renders real data or doesn't). Pure helpers have many input shapes and one
output contract — exactly Vitest's sweet spot.

```svelte
<!-- src/routes/auth/select-tenant/+page.svelte -->
<script lang="ts">
  import { groupMembershipsByType } from './memberships';
  let { data } = $props();
  const groups = $derived(groupMembershipsByType(data.memberships.data ?? []));
</script>
```

```typescript
// src/routes/auth/select-tenant/memberships.test.ts — Vitest, no convex-test needed
test('returns groups in the canonical tenant-type order', () => {
  const groups = groupMembershipsByType([m('a', 'contractor'), m('b', 'consumer')]);
  expect(groups.map((g) => g.type)).toEqual(['consumer', 'contractor']);
});
```

No browser, no Convex, no auth — just input → output. Edge cases (ordering, empty buckets,
duplicate keys) go here. Flow-through-UI goes to E2E.

**E2E gap to know about:** a flow-through-UI assertion for the multi-membership case needs
a seeding helper for tenants + memberships (Better Auth covers user signup via HTTP, but
tenants are only created through `src/convex/init.ts`'s internal action today). Until that
helper exists, the grouping contract is covered by the Vitest helper test and the empty /
signout flows are covered by E2E — we're not blind, just missing one path. See
`tests/routes/auth/select-tenant/select-tenant.spec.ts` for the commented gap.

### Pattern: authenticated page for `/app/*` tests

Most `/app/*` specs need "some authenticated user, any user". Ask for the default `page` fixture
(overridden in rule 4 to sign the context in before handing it off) and you get a `Page` whose
context is already authenticated — no UI login, no `storageState` file. The user is unique per
test by construction.

```typescript
// tests/routes/app/app-home.spec.ts
import { test, expect } from '../../support/fixtures';

test('logged-in user sees their name', async ({ page, user }) => {
  await page.goto('/app');
  await expect(page.getByText(user.name)).toBeVisible();
});
```

If a spec needs two authenticated pages (e.g., "invite sent from one account shows up on
another"), request the fixture once and create a second context manually, because Playwright
fixtures are one instance per test. Resist the urge to generalize that into a second fixture
until at least three specs need it (see `project-structure` rule 6 on promotion).

### Pattern: clicking a Svelte `onclick` handler under Vite dev

Any button whose behavior is wired in the `<script>` tag (`onclick`, `bind:`, etc.) only works
after hydration. Vite dev serves each client chunk as a separate HTTP request, and under
parallel-worker load those requests can outlast the page's `load` event. Clicking too early is a
silent failure: no network request, no console error, URL never changes, and your `toHaveURL`
times out exactly once out of N runs.

The fix is mechanical — wait for network idle before the first interaction that depends on a
hydrated handler:

```typescript
test('clicking Sign out ends the session', async ({ page }) => {
  // Sign out button is a Svelte `onclick` — needs hydration.
  await page.goto('/auth/logout', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/auth\/login/);
});
```

You do not need `networkidle` for plain anchor clicks (`<a href>` works without JS) or for form
submissions that use SvelteKit's `use:enhance` **with a real server action** — the
progressive-enhancement fallback still submits the form the old-fashioned way if hydration is
late. You **do** need it for SPA-mode forms (superforms' `SPA: true`, or any form whose only
wiring is client JS — `onsubmit={preventDefault}`, client-side `onUpdate`, `authClient.signIn`,
etc.) because there is no server-action fallback to save you: without hydration the click either
no-ops or blind-POSTs to a 405 at the route. Our `/auth/login` form is SPA mode, so every spec
that drives the form uses `{ waitUntil: 'networkidle' }` on the initial `goto`.

Rule of thumb: if `+page.server.ts` has no `export const actions`, the form is client-only —
wait for idle.

## Anti-patterns

- **Mocking Convex queries/mutations in Vitest.** Use `convex-test`. The one justifiable exception
  is an external HTTP call inside an `action` — mock `fetch` itself there, not the action.
- **Shared "test user" / "test tenant" across specs.** Any test that logs in as `test@example.com`
  is broken under parallel workers the moment a second spec touches the same account
- **Creating E2E fixtures through the UI** (`page.goto('/auth/register')` + fill). The
  registration flow is under test too, and UI-based fixtures are 10-50× slower than an HTTP call
- **Serializing the whole test suite to "fix" flakes** (`workers: 1`, `fullyParallel: false`).
  Parallelism exposes real shared-state bugs — find them instead of hiding them
- **Booting a Convex deployment per worker.** The isolation model is "unique keys per test", not
  "unique backend per worker"
- **Asserting on implementation details** (`expect(component.state.loading).toBe(true)`, CSS class
  names, internal Svelte stores). Assert on what a user observes
- **Writing a Vitest test for `listMyMemberships` that tries to mock `authComponent.getAuthUser`
  with `vi.mock`.** Either extract the post-auth logic into a pure helper (preferred) or cover it
  in E2E (see rule 6). Mocking the component just relocates the drift
- **Mixing `.test.ts` and `.spec.ts` intentions.** `.test.ts` is Vitest (unit). `.spec.ts` is
  Playwright (E2E). If you swap them, both runners will try to pick both up and neither will work
- **Committing `playwright-report/` or `test-results/`.** Add them to `.gitignore`
- **Running tests against your personal-dev deployment with real data in it.** Keep dev data for
  development; E2E tests assume they can freely create accounts. If you're worried, run
  `bun run clear` before `bun run test:e2e`
- **Long `page.waitForTimeout` calls.** If a test needs a fixed delay, a real condition is being
  missed — use `page.waitForURL`, `expect(locator).toBeVisible()`, or a network idle wait

## References

### Playwright

- [Parallelism](https://playwright.dev/docs/test-parallel) — `fullyParallel`, workers, per-file vs
  cross-file parallelism
- [Authentication](https://playwright.dev/docs/auth) — `storageState`, setup projects, the
  "authenticate once" pattern
- [Locators](https://playwright.dev/docs/locators) — `getByRole`, `getByLabel`, the "user-facing"
  locator hierarchy
- [Web server](https://playwright.dev/docs/test-webserver) — `webServer` config, `reuseExistingServer`
- [Test fixtures](https://playwright.dev/docs/test-fixtures) — how `test.extend` provides per-test
  data (the pattern in rule 4)

### Vitest + convex-test

- [convex-test docs](https://docs.convex.dev/testing/convex-test) — install, `import.meta.glob`
  for `modules`, `withIdentity`, HTTP action testing
- [convex-test on GitHub](https://github.com/get-convex/convex-test) — current examples and
  issues
- [Vitest](https://vitest.dev/) — assertions, mocking, `setupFiles`, test isolation

### Known gotchas

- [get-convex/better-auth #235](https://github.com/get-convex/better-auth/issues/235) — convex-test
  cannot mount the Better Auth component's adapter tables. Rule 6 is the workaround
- [Vitest edge-runtime env](https://edge-runtime.vercel.app/packages/vm) — why the Convex runtime
  needs this env instead of `node` or `jsdom`
