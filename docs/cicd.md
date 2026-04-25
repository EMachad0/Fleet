## When to use

Consult this doc when you are:

- Creating or modifying GitHub Actions workflows
- Debugging CI failures
- Changing Dependabot configuration
- Adding new CI checks or steps

## Overview

CI runs three independent GitHub Actions workflows on every pull request to `main` and every push
to `main`. Each workflow produces its own status check, so reviewers see at a glance which
category failed. All three also support `workflow_dispatch` for manual triggering.

| Workflow | File                          | What it checks                                                    |
| -------- | ----------------------------- | ----------------------------------------------------------------- |
| CI       | `.github/workflows/ci.yml`    | Lint (Prettier + ESLint), type-check (svelte-check), build (Vite) |
| Tests    | `.github/workflows/tests.yml` | Vitest unit tests                                                 |
| E2E      | `.github/workflows/e2e.yml`   | Playwright E2E against isolated Convex backend                    |

Dependabot is configured separately in `.github/dependabot.yml` for automated dependency updates.

## Critical rules

### 1. All workflows share the same trigger and concurrency config

Triggers: `pull_request` to `main`, `push` to `main`, `workflow_dispatch`. Path filters skip runs
when only inert files change (`LICENSE`, `.claude/**`, `.agents/**`, `.husky/**`, `.mise/**`).

Concurrency cancels in-progress runs on PR branches but lets `main` runs complete, so `main`
always has a full pass/fail history:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}
```

### 2. Runtime environment

- **Runner:** `ubuntu-24.04` (pinned LTS, not `ubuntu-latest`)
- **Bun:** `1.x` via `oven-sh/setup-bun@v2`
- **Node.js:** not explicitly installed — uses the runner's pre-installed version
- **Permissions:** `contents: read` (principle of least privilege)

### 3. CI workflow uses `--bun` flag

The CI workflow runs `bun run --bun lint`, `bun run --bun check`, and `bun run --bun build`. The
`--bun` flag forces all child processes through the Bun runtime. Without it, tools like Prettier
resolve `#!/usr/bin/env node` to the runner's system Node.js, which cannot load
`prettier.config.ts`.

### 4. CI workflow needs dummy env vars

The CI workflow sets `PUBLIC_CONVEX_URL`, `PUBLIC_CONVEX_SITE_URL`, and `PUBLIC_SITE_URL` as job
environment variables. These are required by `svelte-check` and `vite build` to resolve
`$env/static/public` imports. The values are dummy `localhost` URLs — they are not used at runtime.

### 5. E2E is fully self-contained

The E2E workflow runs `bun run test:e2e`, which executes `scripts/run-e2e-isolated.ts`. This
script:

1. Spins up a disposable Convex backend via testcontainers
2. Generates all secrets (instance name, instance secret, auth secret)
3. Pushes Convex functions into the isolated backend
4. Starts a Vite dev server via Playwright's `webServer` config
5. Runs Playwright tests
6. Tears down the container

No external secrets or environment variables are needed. Docker is pre-installed on the
`ubuntu-24.04` runner.

### 6. E2E artifacts on failure

On failure, the E2E workflow uploads `playwright-report/` as a GitHub Actions artifact with 7-day
retention. The Playwright config captures traces on first retry and screenshots on failure.
Download the artifact from the workflow run's summary page to debug failures without re-running
locally.

### 7. Caching

- **Bun dependencies:** `oven-sh/setup-bun@v2` handles caching automatically in all workflows
- **Playwright browsers:** cached in `~/.cache/ms-playwright` keyed on `bun.lock` hash. On cache
  hit, only system dependencies are installed (`playwright install-deps chromium`). On cache miss,
  full browser download runs (`playwright install chromium --with-deps`)

## Dependabot

Configured in `.github/dependabot.yml` with two ecosystems:

| Ecosystem        | Schedule | Grouping                | PR limit |
| ---------------- | -------- | ----------------------- | -------- |
| `npm`            | Monthly  | Minor + patch in one PR | 5        |
| `github-actions` | Monthly  | Minor + patch in one PR | 5        |

Security updates are immediate regardless of schedule (Dependabot default). The `npm` ecosystem
covers all Bun/Node dependencies via `package.json`.

## Debugging CI failures

### Re-run a workflow

From the PR's checks section, click "Re-run failed jobs" or "Re-run all jobs". You can also
trigger any workflow manually from the Actions tab via `workflow_dispatch`.

### Read Playwright reports

Download the `playwright-report` artifact from the E2E workflow run's summary page. Open
`index.html` locally to see the full report with screenshots, traces, and error context.

### Reproduce locally

```sh
# CI checks
bun run lint
bun run check
bun run build

# Unit tests
bun run test

# E2E tests (requires Docker)
bun run test:e2e
```

Note: `bun run check` and `bun run build` require `PUBLIC_CONVEX_URL`, `PUBLIC_CONVEX_SITE_URL`,
and `PUBLIC_SITE_URL` in your environment or `.env` file.

## References

- [GitHub Actions documentation](https://docs.github.com/en/actions)
- [Dependabot configuration](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file)
- [oven-sh/setup-bun action](https://github.com/oven-sh/setup-bun)
- [Playwright CI guide](https://playwright.dev/docs/ci-intro)
