## When to use

Consult this doc when you are:

- Setting up a containerized development environment
- Running multiple agent workspaces on the same machine
- Debugging Docker Compose service issues
- Running E2E tests against the containerized stack

## Prerequisites

### dnsmasq (one-time machine setup)

The Docker stack uses `fleet.convex` as the hostname for all services. On the host, `dnsmasq`
resolves this to `127.0.0.1` so the browser and host-side scripts can reach the exposed ports.

```sh
# Install dnsmasq
brew install dnsmasq

# Route fleet.convex to localhost
echo "address=/fleet.convex/127.0.0.1" >> /opt/homebrew/etc/dnsmasq.conf

# Restart dnsmasq
sudo brew services restart dnsmasq

# Tell macOS to use dnsmasq for .convex domains
sudo mkdir -p /etc/resolver
echo "nameserver 127.0.0.1" | sudo tee /etc/resolver/convex
```

Verify it works:

```sh
ping fleet.convex  # should resolve to 127.0.0.1
```

This is a one-time setup per machine. All projects using `.convex` domains will resolve
automatically.

## Overview

The Docker Compose stack runs 4 services that together form a complete, isolated development
environment. Each agent gets its own stack in its own worktree — no port collisions, no shared
state.

### Services

| Service      | Image                                 | Purpose                                                 |
| ------------ | ------------------------------------- | ------------------------------------------------------- |
| `backend`    | `ghcr.io/get-convex/convex-backend`   | Self-hosted Convex backend (API + SQLite database)      |
| `dashboard`  | `ghcr.io/get-convex/convex-dashboard` | Convex dashboard UI for debugging and data inspection   |
| `convex-dev` | Custom (Dockerfile `convex-dev`)      | Runs `convex dev` — watches and pushes Convex functions |
| `web`        | Custom (Dockerfile `web`)             | Runs `bun dev` — SvelteKit dev server with hot reload   |

### Startup order

1. `backend` starts first and exposes a healthcheck (`curl http://localhost:3210/version`)
2. Once healthy, `dashboard`, `convex-dev`, and `web` start in parallel
3. `convex-dev` sets Convex environment variables (`SITE_URL`, `BETTER_AUTH_SECRET`), then pushes
   functions and begins watching for changes
4. `web` starts the Vite dev server

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
bun scripts/generate-ports.ts --offset <N>
```

Computes port assignments and appends them to `.env`:

- `CONVEX_BACKEND_PORT` = 3210 + offset
- `SITE_PROXY_PORT` = 3211 + offset
- `DASHBOARD_PORT` = 6791 + offset
- `VITE_PORT` = 5173 + offset

The `--offset` argument is required (0 is permitted). Each agent on the same machine should use a
different offset to avoid port collisions.

### 3. Start the stack

```sh
docker compose up
```

Docker Compose reads `.env` automatically — no `--env-file` flag needed. All 8 environment
variables are required; the stack fails fast with a clear error if any are missing.

### 4. Access the services

- **App**: `http://fleet.convex:${VITE_PORT}`
- **Dashboard**: `http://fleet.convex:${DASHBOARD_PORT}`

### 5. Stop the stack

```sh
docker compose down
```

Backend data persists in `out/data/` (tied to the worktree). Use `docker compose down -v` or
delete the worktree to remove it.

## Exposed ports

All 4 ports are exposed to the host. Each one is required for a specific reason:

| Port                  | Internal | Why exposed                                                |
| --------------------- | -------- | ---------------------------------------------------------- |
| `CONVEX_BACKEND_PORT` | 3210     | Browser (E2E tests) needs to reach the Convex API directly |
| `SITE_PROXY_PORT`     | 3211     | Browser needs to reach auth callback HTTP action routes    |
| `DASHBOARD_PORT`      | 6791     | Debugging and data inspection from the host                |
| `VITE_PORT`           | 5173     | Main app entry point for the agent and E2E tests           |

## Port isolation

Multiple agents on the same machine each use a different `--offset`:

```sh
# Agent 1
bun scripts/generate-ports.ts --offset 0     # ports 3210, 3211, 6791, 5173

# Agent 2
bun scripts/generate-ports.ts --offset 10000  # ports 13210, 13211, 16791, 15173

# Agent 3
bun scripts/generate-ports.ts --offset 20000  # ports 23210, 23211, 26791, 25173
```

Each agent runs in its own worktree with its own `.env` and its own `docker compose up`.

## Environment variable flow

```
generate-convex-secrets.ts ──┐
                             ├──▶ .env ──▶ docker compose ──▶ container env vars
generate-ports.ts ───────────┘
```

Variables flow from the host `.env` into Docker Compose via `${VAR:?missing VAR}` interpolation.
Inside the compose file, each service receives only the variables it needs:

- **backend**: `INSTANCE_NAME`, `INSTANCE_SECRET`, `CONVEX_CLOUD_ORIGIN`, `CONVEX_SITE_ORIGIN`
- **dashboard**: `NEXT_PUBLIC_DEPLOYMENT_URL`
- **convex-dev**: `CONVEX_SELF_HOSTED_URL` (hardcoded to `http://backend:3210`),
  `CONVEX_SELF_HOSTED_ADMIN_KEY`, `BETTER_AUTH_SECRET`, `VITE_PORT`
- **web**: `PUBLIC_CONVEX_URL`, `PUBLIC_CONVEX_SITE_URL`, `PUBLIC_SITE_URL`

## Networking

Services communicate internally via Docker DNS (e.g., `convex-dev` reaches the backend at
`http://backend:3210`). The default Docker Compose network is used.

All browser-facing and SSR URLs (`PUBLIC_*`, `CONVEX_*_ORIGIN`, `NEXT_PUBLIC_*`) use
`http://fleet.convex:<port>`. This hostname resolves correctly in both contexts:

- **On the host (browser, scripts)**: `dnsmasq` resolves `fleet.convex` to `127.0.0.1`
- **Inside `web` and `dashboard` containers**: `extra_hosts` maps `fleet.convex` to `host-gateway`
  (the host machine), reaching the backend through exposed ports

The `convex-dev` service communicates directly with the backend via Docker DNS
(`http://backend:3210`) since it doesn't need to go through the host.

## Volume mounts (hot reload)

Source files are mounted from the host into containers so edits are reflected immediately without
rebuilding:

| Service      | Mounts                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------- |
| `convex-dev` | `src/convex/`, `convex.json`                                                                |
| `web`        | `src/`, `svelte.config.js`, `vite.config.ts`, `tsconfig.json`, `components.json`, `static/` |
| `backend`    | `out/data/` — SQLite database, persists across restarts, tied to the worktree               |

`node_modules` is installed at image build time inside the container — it is NOT mounted from the
host. This avoids darwin/linux binary mismatches.

## Dockerfile

The Dockerfile is multi-stage with a shared `base`:

- **`base`**: `oven/bun:latest`, installs dependencies, copies source
- **`convex-dev`**: adds the entrypoint script that sets Convex env vars then runs `convex dev`
- **`web`**: runs `bun dev --host --port 5173`

The `.dockerignore` uses an allowlist approach — starts with `*` (ignore everything), then
explicitly allows only what the image needs. Test files are excluded.

## Backend data lifecycle

Backend data (SQLite database, file storage) lives in `out/data/`, which is a bind mount to the
host worktree. This means:

- Data survives `docker compose down` and `docker compose up` cycles
- Data is automatically cleaned up when the worktree is removed
- Each agent's data is fully isolated

## Running E2E tests

E2E tests (Playwright) run on the host against the containerized stack:

```sh
# Start the stack
docker compose up -d

# Run tests
bun run test:e2e

# Stop the stack
docker compose down
```

The browser launched by Playwright runs on the host and reaches services via
`http://localhost:<port>`. The `PUBLIC_*` env vars use `host.docker.internal` which resolves
correctly from both the host browser and the container's SSR.
