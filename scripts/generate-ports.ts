#!/usr/bin/env bun
import { resolve } from 'node:path';
import { merge } from './lib/dotenv.ts';

const BASE_PORTS = {
  CONVEX_BACKEND_PORT: 3210,
  SITE_PROXY_PORT: 3211,
  DASHBOARD_PORT: 6791,
  VITE_PORT: 5173,
} as const;

const ENV_PATH = resolve(import.meta.dirname, '..', '.env');

function parseOffset(): number {
  const offsetIndex = process.argv.indexOf('--offset');
  if (offsetIndex === -1 || offsetIndex + 1 >= process.argv.length) {
    console.error('Usage: bun scripts/generate-ports.ts --offset <N>');
    console.error('  <N>  non-negative integer port offset (0 is permitted)');
    process.exit(1);
  }

  const raw = process.argv[offsetIndex + 1];
  const offset = Number(raw);
  if (!Number.isInteger(offset) || offset < 0) {
    console.error(`Error: offset must be a non-negative integer, got "${raw}"`);
    process.exit(1);
  }

  return offset;
}

function computePorts(offset: number): Record<string, string> {
  const entries: Record<string, string> = {};
  for (const [key, base] of Object.entries(BASE_PORTS)) {
    entries[key] = String(base + offset);
  }
  return entries;
}

function main() {
  const offset = parseOffset();
  const entries = computePorts(offset);

  entries.CONVEX_SELF_HOSTED_URL = `http://fleet.convex:${entries.CONVEX_BACKEND_PORT}`;

  merge(ENV_PATH, entries);

  console.log('Wrote port variables to .env:');
  for (const [key, value] of Object.entries(entries)) {
    console.log(`  ${key}=${value}`);
  }
}

main();
