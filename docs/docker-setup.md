## When to use

Consult this doc when you are:

- Setting up a containerized development environment
- Running multiple agent workspaces on the same machine
- Debugging Docker Compose service issues
- Running E2E tests against the containerized stack

## Overview

The Docker Compose stack runs 3 services that form the backend infrastructure for an isolated
development environment. The SvelteKit dev server (`bun dev`) runs on the host for native HMR
and filesystem watching. Each agent gets its own stack in its own worktree — no port collisions,
no shared state.

### Services

| Service      | Image                                 | Purpose                                                 |
| ------------ | ------------------------------------- | ------------------------------------------------------- |
| `backend`    | `ghcr.io/get-convex/convex-backend`   | Self-hosted Convex backend (API + SQLite database)      |
| `dashboard`  | `ghcr.io/get-convex/convex-dashboard` | Convex dashboard UI for debugging and data inspection   |
| `convex-dev` | Custom (Dockerfile `convex-dev`)      | Runs `convex dev` — watches and pushes Convex functions |

The SvelteKit dev server runs on the host via `bun dev` — not inside Docker. This preserves
native HMR (hot module replacement) and avoids filesystem watcher issues with Docker bind mounts.

### Startup order

1. `backend` starts first and exposes a healthcheck (`curl http://localhost:3210/version`)
2. Once healthy, `dashboard` and `convex-dev` start in parallel
3. `convex-dev` sets Convex environment variables (`SITE_URL`, `BETTER_AUTH_SECRET`), then pushes
   functions and begins watching for changes
4. The developer/agent starts `bun dev` on the host

## Setup flow

### 1. Generate secrets

```sh
bun scripts/generate-convex-secrets.ts
```

Spins up a temporary Convex backend via testcontainers, generates credentials, and writes them to
`.env`:

- `INSTANCE_NAME` — Convex backend identity (defaults to `convex-self-hosted`)
- `INSTANCE_SECRET` — random 64-char hex secret
- `CONVEX_SELF_HOSTED_ADMIN_KEY` — derived from name + secret using the backend's `generate_key`
  binary
- `BETTER_AUTH_SECRET` — random secret for better-auth sessions

Re-running always regenerates all values. If `INSTANCE_NAME` or `INSTANCE_SECRET` already exist in
`.env`, they are preserved and the admin key is re-derived from them.

### 2. Generate ports

```sh
bun scripts/generate-ports.ts --auto
```

Automatically finds the first available port offset (in steps of 10,000) by probing the host for
occupied ports. Writes port assignments and derived URLs to `.env`:

- `CONVEX_BACKEND_PORT` = 3210 + offset
- `SITE_PROXY_PORT` = 3211 + offset
- `DASHBOARD_PORT` = 6791 + offset
- `VITE_PORT` = 5173 + offset
- `CONVEX_SELF_HOSTED_URL` = `http://localhost:<CONVEX_BACKEND_PORT>`
- `PUBLIC_CONVEX_URL` = `http://localhost:<CONVEX_BACKEND_PORT>`
- `PUBLIC_CONVEX_SITE_URL` = `http://localhost:<SITE_PROXY_PORT>`
- `PUBLIC_SITE_URL` = `http://localhost:<VITE_PORT>`

You can also specify an explicit offset with `--offset <N>` (0 is permitted). The script checks
port availability and fails fast if any port is already in use. Prefer `--auto` for multi-agent
setups — it handles offset coordination automatically.

### 3. Start the backend stack

```sh
docker compose up -d
```

Docker Compose reads `.env` automatically — no `--env-file` flag needed. All required environment
variables must be present; the stack fails fast with a clear error if any are missing.

### 4. Start the dev server

```sh
bun dev --port ${VITE_PORT}
```

The SvelteKit dev server runs on the host. It reads `PUBLIC_CONVEX_URL`,
`PUBLIC_CONVEX_SITE_URL`, and `PUBLIC_SITE_URL` from `.env` (auto-loaded by Bun) to connect to
the Convex backend running in Docker.

### 5. Access the services

- **App**: `http://localhost:${VITE_PORT}`
- **Dashboard**: `http://localhost:${DASHBOARD_PORT}`

### 6. Stop the stack

```sh
docker compose down
```

Backend data persists in `out/data/` (tied to the worktree). Delete the worktree to remove it.

## Troubleshooting

### Stale `.env.local`

Bun loads `.env.local` with higher priority than `.env`. If a stale `.env.local` exists (e.g.
from a previous `bun run test:e2e` run), it will override the correct values in `.env`. Delete
it:

```sh
rm .env.local
```

Then restart Vite to pick up the correct values.

## Exposed ports

3 ports are exposed to the host from Docker:

| Port                  | Internal | Why exposed                                              |
| --------------------- | -------- | -------------------------------------------------------- |
| `CONVEX_BACKEND_PORT` | 3210     | Browser (WebSocket), SSR (HTTP client), and host scripts |
| `SITE_PROXY_PORT`     | 3211     | Browser and SSR (auth callbacks, HTTP actions)           |
| `DASHBOARD_PORT`      | 6791     | Debugging and data inspection from the host              |

`VITE_PORT` is used by the host-side `bun dev` process directly — no Docker port mapping needed.

## Port isolation

Multiple agents on the same machine each run `--auto` to get a conflict-free offset:

```sh
# Each agent — --auto finds the first free offset automatically
bun scripts/generate-ports.ts --auto
```

Each agent runs in its own worktree with its own `.env` and its own `docker compose up`.
The `--auto` flag probes the host for occupied ports and picks the first available offset
(0, 10000, 20000, …), so agents don't need to coordinate manually.

## Environment variable flow

```
generate-convex-secrets.ts ──┐
                             ├──▶ .env ──▶ docker compose ──▶ container env vars
generate-ports.ts ───────────┘              bun dev ──────────▶ PUBLIC_* env vars
```

Variables flow from the host `.env` into Docker Compose via `${VAR:?missing VAR}` interpolation.
Bun auto-loads `.env` when running `bun dev`, so the SvelteKit app picks up `PUBLIC_*` vars
automatically.

Inside the compose file, each service receives only the variables it needs:

- **backend**: `INSTANCE_NAME`, `INSTANCE_SECRET`, `CONVEX_CLOUD_ORIGIN`, `CONVEX_SITE_ORIGIN`
- **dashboard**: `NEXT_PUBLIC_DEPLOYMENT_URL`
- **convex-dev**: `CONVEX_SELF_HOSTED_URL` (hardcoded to `http://backend:3210`),
  `CONVEX_SELF_HOSTED_ADMIN_KEY`, `BETTER_AUTH_SECRET`, `VITE_PORT`

## Networking

Services communicate internally via Docker DNS (e.g., `convex-dev` reaches the backend at
`http://backend:3210`). The default Docker Compose network is used.

All browser-facing and SSR URLs use `http://localhost:<port>`. Since the SvelteKit dev server
runs on the host (not inside Docker), both the browser and SSR resolve `localhost` to the same
machine. The Convex backend ports are exposed to the host, so `localhost:<port>` reaches them
from both contexts.

## Volume mounts

Source files are mounted from the host into the `convex-dev` container so Convex function changes
are detected immediately:

| Service      | Mounts                                                 |
| ------------ | ------------------------------------------------------ |
| `convex-dev` | `src/convex/`, `convex.json`                           |
| `backend`    | `out/data/` — SQLite database, tied to the worktree    |

`node_modules` is installed at image build time inside the container — it is NOT mounted from the
host. This avoids darwin/linux binary mismatches.

## Dockerfile

The Dockerfile has a `base` stage and a `convex-dev` stage:

- **`base`**: `oven/bun:latest`, installs dependencies, copies source
- **`convex-dev`**: adds the entrypoint script that sets Convex env vars then runs `convex dev`

The `.dockerignore` uses an allowlist approach — starts with `*` (ignore everything), then
explicitly allows only what the image needs. Test files are excluded.

## Backend data lifecycle

Backend data (SQLite database, file storage) lives in `out/data/`, which is a bind mount to the
host worktree. This means:

- Data survives `docker compose down` and `docker compose up` cycles
- Data is automatically cleaned up when the worktree is removed
- Each agent's data is fully isolated

## Running E2E tests

E2E tests use `scripts/run-e2e-isolated.ts`, which boots its own disposable Convex backend via
testcontainers and Playwright's `webServer` config starts Vite automatically. No manual setup
needed:

```sh
bun run test:e2e
```

The E2E suite is fully self-contained — it does not use the Docker Compose stack.
