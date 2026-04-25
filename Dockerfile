FROM oven/bun:latest AS base
WORKDIR /fleet
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .

FROM base AS convex-dev
COPY scripts/docker-entrypoint-convex-dev.sh /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
