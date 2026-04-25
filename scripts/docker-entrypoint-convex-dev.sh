#!/bin/sh
set -e

bun run prepare

bunx convex env set SITE_URL "http://fleet.convex:${VITE_PORT}"
bunx convex env set BETTER_AUTH_SECRET "${BETTER_AUTH_SECRET}"

exec bunx convex dev
