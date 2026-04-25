// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import {
  BASE_PORTS,
  checkPorts,
  computePorts,
  findAvailableOffset,
  generatePorts,
  isPortAvailable,
  OFFSET_STEP,
} from './ports.ts';

describe('computePorts', () => {
  test('offset 0 returns base ports', () => {
    const ports = computePorts(0);
    expect(ports).toEqual({
      CONVEX_BACKEND_PORT: 3210,
      SITE_PROXY_PORT: 3211,
      DASHBOARD_PORT: 6791,
      VITE_PORT: 5173,
    });
  });

  test('offset shifts all ports by the given amount', () => {
    const ports = computePorts(10000);
    expect(ports).toEqual({
      CONVEX_BACKEND_PORT: 13210,
      SITE_PROXY_PORT: 13211,
      DASHBOARD_PORT: 16791,
      VITE_PORT: 15173,
    });
  });
});

describe('isPortAvailable', () => {
  let server: Server | undefined;

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = undefined;
    }
  });

  test('returns true for a free port', async () => {
    const freePort = await new Promise<number>((resolve, reject) => {
      const s = createServer();
      s.listen(0, '0.0.0.0', () => {
        const addr = s.address();
        if (!addr || typeof addr === 'string') return reject(new Error('no address'));
        const port = addr.port;
        s.close(() => resolve(port));
      });
    });

    expect(await isPortAvailable(freePort)).toBe(true);
  });

  test('returns false for a port already in use', async () => {
    server = createServer();
    const port = await new Promise<number>((resolve, reject) => {
      server!.on('error', reject);
      server!.listen(0, '0.0.0.0', () => {
        const addr = server!.address();
        if (!addr || typeof addr === 'string') return reject(new Error('no address'));
        resolve(addr.port);
      });
    });

    expect(await isPortAvailable(port)).toBe(false);
  });
});

describe('checkPorts', () => {
  let servers: Server[] = [];

  afterEach(async () => {
    await Promise.all(servers.map((s) => new Promise<void>((resolve) => s.close(() => resolve()))));
    servers = [];
  });

  function bindPort(): Promise<number> {
    return new Promise((resolve, reject) => {
      const s = createServer();
      s.on('error', reject);
      s.listen(0, '0.0.0.0', () => {
        const addr = s.address();
        if (!addr || typeof addr === 'string') return reject(new Error('no address'));
        servers.push(s);
        resolve(addr.port);
      });
    });
  }

  test('returns no conflicts when all ports are free', async () => {
    const result = await checkPorts({ A: 0, B: 0 });
    expect(result.conflicts).toEqual([]);
  });

  test('returns conflicting port numbers when ports are occupied', async () => {
    const occupied = await bindPort();
    const result = await checkPorts({ A: occupied, B: 0 });
    expect(result.conflicts).toContain(occupied);
  });
});

describe('findAvailableOffset', () => {
  let servers: Server[] = [];

  afterEach(async () => {
    await Promise.all(servers.map((s) => new Promise<void>((resolve) => s.close(() => resolve()))));
    servers = [];
  });

  async function tryBindPort(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const s = createServer();
      s.on('error', () => resolve(false));
      s.listen(port, '0.0.0.0', () => {
        servers.push(s);
        resolve(true);
      });
    });
  }

  test('skips offsets whose ports are occupied', async () => {
    const candidates = [40_000, 30_000, 20_000, 10_000];
    let testStart: number | undefined;
    for (const offset of candidates) {
      const port = BASE_PORTS.CONVEX_BACKEND_PORT + offset;
      if (await tryBindPort(port)) {
        testStart = offset;
        break;
      }
    }
    if (testStart === undefined) throw new Error('Could not bind any test port');

    const offset = await findAvailableOffset({ startOffset: testStart });
    expect(offset).not.toBe(testStart);
    expect(offset % OFFSET_STEP).toBe(0);
  });

  test('returns startOffset when its ports are all free', async () => {
    const candidates = [50_000, 40_000, 30_000, 20_000];
    let freeOffset: number | undefined;
    for (const offset of candidates) {
      const portsForOffset = computePorts(offset);
      const { conflicts } = await checkPorts(portsForOffset);
      if (conflicts.length === 0) {
        freeOffset = offset;
        break;
      }
    }
    if (freeOffset === undefined) throw new Error('Could not find a free offset');

    const offset = await findAvailableOffset({ startOffset: freeOffset });
    expect(offset).toBe(freeOffset);
  });
});

describe('generatePorts', () => {
  let tmpDir: string;
  let envPath: string;
  let servers: Server[] = [];

  async function tryBindPort(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const s = createServer();
      s.on('error', () => resolve(false));
      s.listen(port, '0.0.0.0', () => {
        servers.push(s);
        resolve(true);
      });
    });
  }

  afterEach(async () => {
    await Promise.all(servers.map((s) => new Promise<void>((resolve) => s.close(() => resolve()))));
    servers = [];
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function setup(existingEnv?: string) {
    tmpDir = mkdtempSync(join(tmpdir(), 'ports-test-'));
    envPath = join(tmpDir, '.env');
    if (existingEnv) writeFileSync(envPath, existingEnv);
  }

  async function findFreeOffset(): Promise<number> {
    for (const offset of [40_000, 30_000, 20_000, 10_000, 50_000]) {
      const p = computePorts(offset);
      const { conflicts } = await checkPorts(p);
      if (conflicts.length === 0) return offset;
    }
    throw new Error('Could not find a free offset for test');
  }

  test('--offset writes ports and derived URLs to .env', async () => {
    setup();
    const offset = await findFreeOffset();
    const expectedBackend = BASE_PORTS.CONVEX_BACKEND_PORT + offset;
    await generatePorts({ mode: 'offset', offset, envPath });

    const content = readFileSync(envPath, 'utf8');
    expect(content).toContain(`CONVEX_BACKEND_PORT=${expectedBackend}`);
    expect(content).toContain(`PUBLIC_CONVEX_URL=http://localhost:${expectedBackend}`);
  });

  test('--offset rejects occupied ports', async () => {
    setup();
    const candidates = [40_000, 30_000, 20_000, 10_000];
    let blockedOffset: number | undefined;
    for (const offset of candidates) {
      const port = BASE_PORTS.CONVEX_BACKEND_PORT + offset;
      if (await tryBindPort(port)) {
        blockedOffset = offset;
        break;
      }
    }
    if (blockedOffset === undefined) throw new Error('Could not bind any test port');

    const blockedPort = BASE_PORTS.CONVEX_BACKEND_PORT + blockedOffset;
    await expect(generatePorts({ mode: 'offset', offset: blockedOffset, envPath })).rejects.toThrow(
      new RegExp(String(blockedPort)),
    );
  });

  test('--auto finds a free offset and writes to .env', async () => {
    setup();
    const freeOffset = await findFreeOffset();
    const result = await generatePorts({ mode: 'auto', envPath, startOffset: freeOffset });

    const content = readFileSync(envPath, 'utf8');
    expect(content).toContain('CONVEX_BACKEND_PORT=');
    expect(result.offset).toBe(freeOffset);
  });

  test('--auto skips occupied offsets', async () => {
    setup();
    const candidates = [40_000, 30_000, 20_000, 10_000];
    let blockedOffset: number | undefined;
    for (const offset of candidates) {
      const port = BASE_PORTS.CONVEX_BACKEND_PORT + offset;
      if (await tryBindPort(port)) {
        blockedOffset = offset;
        break;
      }
    }
    if (blockedOffset === undefined) throw new Error('Could not bind any test port');

    const result = await generatePorts({ mode: 'auto', envPath, startOffset: blockedOffset });
    expect(result.offset).not.toBe(blockedOffset);
  });

  test('preserves existing .env entries', async () => {
    setup('INSTANCE_NAME=my-instance\nINSTANCE_SECRET=abc123\n');
    const offset = await findFreeOffset();
    const expectedBackend = BASE_PORTS.CONVEX_BACKEND_PORT + offset;
    await generatePorts({ mode: 'offset', offset, envPath });

    const content = readFileSync(envPath, 'utf8');
    expect(content).toContain('INSTANCE_NAME=my-instance');
    expect(content).toContain(`CONVEX_BACKEND_PORT=${expectedBackend}`);
  });
});
