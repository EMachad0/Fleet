import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { merge, read as readEnv } from './dotenv.ts';
import { isPortAvailable } from './is-port-available.ts';
export { isPortAvailable };

export const BASE_PORTS = {
  CONVEX_BACKEND_PORT: 3210,
  SITE_PROXY_PORT: 3211,
  DASHBOARD_PORT: 6791,
  VITE_PORT: 5173,
} as const;

export const OFFSET_STEP = 10_000;

export function computePorts(offset: number): Record<string, number> {
  const entries: Record<string, number> = {};
  for (const [key, base] of Object.entries(BASE_PORTS)) {
    entries[key] = base + offset;
  }
  return entries;
}

export async function checkPorts(ports: Record<string, number>): Promise<{ conflicts: number[] }> {
  const values = Object.values(ports).filter((p) => p > 0);
  const results = await Promise.all(
    values.map((p) => isPortAvailable(p).then((ok) => ({ port: p, ok }))),
  );
  return { conflicts: results.filter((r) => !r.ok).map((r) => r.port) };
}

const MAX_OFFSET = 50_000;

export function getClaimedOffsets(parentDir: string): number[] {
  let entries: string[];
  try {
    entries = readdirSync(parentDir);
  } catch {
    return [];
  }

  const offsets: number[] = [];
  for (const entry of entries) {
    const envPath = join(parentDir, entry, '.env');
    try {
      statSync(envPath);
    } catch {
      continue;
    }
    const env = readEnv(envPath);
    const raw = env.PORT_OFFSET;
    if (raw !== undefined) {
      const offset = Number(raw);
      if (Number.isInteger(offset) && offset >= 0) offsets.push(offset);
    }
  }
  return offsets;
}

export async function findAvailableOffset(opts?: {
  startOffset?: number;
  excludeOffsets?: number[];
}): Promise<number> {
  const start = opts?.startOffset ?? 0;
  const excluded = new Set(opts?.excludeOffsets ?? []);
  for (let offset = start; offset <= MAX_OFFSET; offset += OFFSET_STEP) {
    if (excluded.has(offset)) continue;
    const ports = computePorts(offset);
    const { conflicts } = await checkPorts(ports);
    if (conflicts.length === 0) return offset;
  }
  throw new Error(
    `No available port offset found (tried ${start}–${MAX_OFFSET} in steps of ${OFFSET_STEP})`,
  );
}

type GeneratePortsOpts =
  | { mode: 'offset'; offset: number; envPath: string }
  | { mode: 'auto'; envPath: string; startOffset?: number; excludeOffsets?: number[] };

export async function generatePorts(
  opts: GeneratePortsOpts,
): Promise<{ offset: number; entries: Record<string, string> }> {
  let offset: number;
  if (opts.mode === 'offset') {
    offset = opts.offset;
    const ports = computePorts(offset);
    const { conflicts } = await checkPorts(ports);
    if (conflicts.length > 0) {
      throw new Error(
        `Port conflict: ${conflicts.join(', ')} already in use. Choose a different offset or use --auto.`,
      );
    }
  } else {
    offset = await findAvailableOffset({
      startOffset: opts.startOffset,
      excludeOffsets: opts.excludeOffsets,
    });
  }

  const ports = computePorts(offset);
  const entries: Record<string, string> = {};
  for (const [key, value] of Object.entries(ports)) {
    entries[key] = String(value);
  }
  entries.PORT_OFFSET = String(offset);
  entries.CONVEX_SELF_HOSTED_URL = `http://localhost:${entries.CONVEX_BACKEND_PORT}`;
  entries.PUBLIC_CONVEX_URL = `http://localhost:${entries.CONVEX_BACKEND_PORT}`;
  entries.PUBLIC_CONVEX_SITE_URL = `http://localhost:${entries.SITE_PROXY_PORT}`;
  entries.PUBLIC_SITE_URL = `http://localhost:${entries.VITE_PORT}`;

  merge(opts.envPath, entries);
  return { offset, entries };
}
