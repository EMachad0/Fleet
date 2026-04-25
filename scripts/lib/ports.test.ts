// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import {
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

  function bindSpecificPort(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const s = createServer();
      s.on('error', reject);
      s.listen(port, '0.0.0.0', () => {
        servers.push(s);
        resolve();
      });
    });
  }

  test('skips offsets whose ports are occupied', async () => {
    const testStart = 40_000;
    const blockedPort = 3210 + testStart;
    await bindSpecificPort(blockedPort);

    const offset = await findAvailableOffset({ startOffset: testStart });
    expect(offset).not.toBe(testStart);
    expect(offset % OFFSET_STEP).toBe(0);
  });

  test('returns startOffset when its ports are all free', async () => {
    const offset = await findAvailableOffset({ startOffset: 50_000 });
    expect(offset).toBe(50_000);
  });
});

describe('generatePorts', () => {
  let tmpDir: string;
  let envPath: string;
  let servers: Server[] = [];

  function bindSpecificPort(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const s = createServer();
      s.on('error', reject);
      s.listen(port, '0.0.0.0', () => {
        servers.push(s);
        resolve();
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

  test('--offset writes ports and derived URLs to .env', async () => {
    setup();
    await generatePorts({ mode: 'offset', offset: 40_000, envPath });

    const content = readFileSync(envPath, 'utf8');
    expect(content).toContain('CONVEX_BACKEND_PORT=43210');
    expect(content).toContain('PUBLIC_CONVEX_URL=http://localhost:43210');
  });

  test('--offset rejects occupied ports', async () => {
    setup();
    await bindSpecificPort(43210);

    await expect(generatePorts({ mode: 'offset', offset: 40_000, envPath })).rejects.toThrow(
      /43210/,
    );
  });

  test('--auto finds a free offset and writes to .env', async () => {
    setup();
    const result = await generatePorts({ mode: 'auto', envPath, startOffset: 40_000 });

    const content = readFileSync(envPath, 'utf8');
    expect(content).toContain('CONVEX_BACKEND_PORT=');
    expect(result.offset).toBe(40_000);
  });

  test('--auto skips occupied offsets', async () => {
    setup();
    await bindSpecificPort(43210);

    const result = await generatePorts({ mode: 'auto', envPath, startOffset: 40_000 });
    expect(result.offset).not.toBe(40_000);
  });

  test('preserves existing .env entries', async () => {
    setup('INSTANCE_NAME=my-instance\nINSTANCE_SECRET=abc123\n');
    await generatePorts({ mode: 'offset', offset: 40_000, envPath });

    const content = readFileSync(envPath, 'utf8');
    expect(content).toContain('INSTANCE_NAME=my-instance');
    expect(content).toContain('CONVEX_BACKEND_PORT=43210');
  });
});
