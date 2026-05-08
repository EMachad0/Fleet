#!/usr/bin/env bun
import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { merge, read } from './lib/dotenv.ts';

const CONVEX_BACKEND_IMAGE = 'ghcr.io/get-convex/convex-backend:latest';
const STARTUP_TIMEOUT_MS = 300_000;
const ENV_PATH = resolve(import.meta.dirname, '..', '.env');

function randomHex(): string {
  return randomBytes(32).toString('hex');
}

function parseAdminKey(output: string): string | null {
  return output.match(/\S+\|\S+/g)?.at(-1) ?? null;
}

function deriveAdminKey(containerId: string, instanceName: string, instanceSecret: string): string {
  const output = execSync(
    `docker exec ${containerId} ./generate_key ${instanceName} ${instanceSecret}`,
    { encoding: 'utf8', timeout: 30_000, stdio: ['pipe', 'pipe', 'pipe'] },
  );
  const adminKey = parseAdminKey(output);
  if (adminKey) return adminKey;
  throw new Error(`Failed to generate a Convex admin key: ${output}`);
}

async function startTemporaryBackend(instanceName: string, instanceSecret: string) {
  const { GenericContainer, Wait } = await import('testcontainers');

  return new GenericContainer(CONVEX_BACKEND_IMAGE)
    .withAutoRemove(true)
    .withStartupTimeout(STARTUP_TIMEOUT_MS)
    .withHealthCheck({
      test: ['CMD-SHELL', 'curl -f http://localhost:3210/version'],
      interval: 5_000,
      timeout: 5_000,
      retries: 24,
      startPeriod: 10_000,
    })
    .withWaitStrategy(Wait.forHealthCheck())
    .withExposedPorts(3210)
    .withEnvironment({
      INSTANCE_NAME: instanceName,
      INSTANCE_SECRET: instanceSecret,
      DISABLE_BEACON: 'true',
      DISABLE_METRICS_ENDPOINT: 'true',
    })
    .start();
}

async function generateAdminKey(instanceName: string, instanceSecret: string): Promise<string> {
  console.log(`Starting temporary Convex backend (${CONVEX_BACKEND_IMAGE})...`);
  const container = await startTemporaryBackend(instanceName, instanceSecret);
  try {
    console.log('Deriving admin key...');
    return deriveAdminKey(container.getId(), instanceName, instanceSecret);
  } finally {
    console.log('Stopping temporary backend...');
    try {
      await container.stop({ remove: true, removeVolumes: true });
    } catch {
      // autoRemove may have already cleaned up the container
    }
  }
}

function maskSecret(key: string, value: string): string {
  if (key.includes('SECRET') || key.includes('KEY')) return `${value.slice(0, 8)}...`;
  return value;
}

async function main() {
  const existing = read(ENV_PATH);

  const instanceName = existing.INSTANCE_NAME ?? 'convex-self-hosted';
  const instanceSecret = existing.INSTANCE_SECRET ?? randomHex();
  const betterAuthSecret = existing.BETTER_AUTH_SECRET ?? randomHex();
  const adminKey = await generateAdminKey(instanceName, instanceSecret);

  const entries: Record<string, string> = {
    INSTANCE_NAME: instanceName,
    INSTANCE_SECRET: instanceSecret,
    CONVEX_SELF_HOSTED_ADMIN_KEY: adminKey,
    BETTER_AUTH_SECRET: betterAuthSecret,
  };

  merge(ENV_PATH, entries);

  console.log('Wrote secrets to .env:');
  for (const [key, value] of Object.entries(entries)) {
    console.log(`  ${key}=${maskSecret(key, value)}`);
  }
}

await main();
process.exit(0);
