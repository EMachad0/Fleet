#!/usr/bin/env bun
import { execSync, spawnSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:net';

const debugIndex = process.argv.indexOf('--debug');
const debug = debugIndex !== -1;
if (debug) process.argv.splice(debugIndex, 1);

if (debug) process.env.DEBUG = process.env.DEBUG || 'testcontainers*';

const { GenericContainer, Wait } = await import('testcontainers');

const HOST = '127.0.0.1';
const CONVEX_BACKEND_IMAGE = 'ghcr.io/get-convex/convex-backend:latest';
const CONVEX_BACKEND_PORT = 3210;
const CONVEX_SITE_PORT = 3211;
const STARTUP_TIMEOUT_MS = 300_000;

type CommandResult = { status: number; signal: NodeJS.Signals | null };

function runBun(args: string[], env: NodeJS.ProcessEnv, opts?: { filter?: RegExp }): CommandResult {
  const useFilter = opts?.filter && !debug;
  const result = spawnSync(process.execPath, args, {
    stdio: useFilter ? ['inherit', 'pipe', 'pipe'] : 'inherit',
    env,
  });

  if (useFilter) {
    for (const buf of [result.stdout, result.stderr]) {
      if (!buf) continue;
      const text = typeof buf === 'string' ? buf : buf.toString('utf8');
      const filtered = text
        .split('\n')
        .filter((line) => !opts.filter!.test(line))
        .join('\n');
      if (filtered.trim()) process.stderr.write(filtered);
    }
  }

  return {
    status: result.status ?? 1,
    signal: result.signal,
  };
}

function exitFrom(result: CommandResult): never {
  if (result.signal) {
    process.kill(process.pid, result.signal);
    process.exit(1);
  }
  process.exit(result.status);
}

async function reservePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, HOST, () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Failed to determine reserved port'));
        return;
      }
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(address.port);
      });
    });
  });
}

function parseAdminKey(output: string): string | null {
  return output.match(/\S+\|\S+/g)?.at(-1) ?? null;
}

function generateAdminKey(
  containerId: string,
  instanceName: string,
  instanceSecret: string,
): string {
  const output = execSync(
    `docker exec ${containerId} ./generate_key ${instanceName} ${instanceSecret}`,
    { encoding: 'utf8', timeout: 30_000 },
  );
  const adminKey = parseAdminKey(output);
  if (adminKey) return adminKey;
  throw new Error(`Failed to generate a Convex admin key: ${output}`);
}

function createRunEnv(args: {
  adminKey: string;
  backendUrl: string;
  siteProxyUrl: string;
  appUrl: string;
}): NodeJS.ProcessEnv {
  const env = { ...process.env };

  delete env.CONVEX_DEPLOYMENT;
  delete env.CONVEX_DEPLOY_KEY;

  if (debug) env.E2E_DEBUG = '1';
  env.CONVEX_SELF_HOSTED_URL = args.backendUrl;
  env.CONVEX_SELF_HOSTED_ADMIN_KEY = args.adminKey;
  env.PUBLIC_CONVEX_URL = args.backendUrl;
  env.PUBLIC_CONVEX_SITE_URL = args.siteProxyUrl;
  env.PUBLIC_SITE_URL = args.appUrl;

  return env;
}

async function main() {
  const playwrightArgs = process.argv.slice(2);
  const runId = randomUUID().replace(/-/g, '').slice(0, 12);
  const instanceName = `fleet-e2e-${runId}`;
  const instanceSecret = randomBytes(32).toString('hex');

  const [backendPort, siteProxyPort, appPort] = await Promise.all([
    reservePort(),
    reservePort(),
    reservePort(),
  ]);

  const backendUrl = `http://${HOST}:${backendPort}`;
  const siteProxyUrl = `http://${HOST}:${siteProxyPort}`;
  const appUrl = `http://${HOST}:${appPort}`;

  let result: CommandResult | undefined;
  let container: Awaited<ReturnType<InstanceType<typeof GenericContainer>['start']>> | undefined;
  let containerLogs = '';

  try {
    console.log('[e2e] Starting disposable self-hosted Convex backend...');
    console.log(`[e2e] Image: ${CONVEX_BACKEND_IMAGE}`);
    console.log(`[e2e] Ports: backend=${backendPort}, site=${siteProxyPort}`);
    container = await new GenericContainer(CONVEX_BACKEND_IMAGE)
      .withName(instanceName)
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
      .withExposedPorts(
        { container: CONVEX_BACKEND_PORT, host: backendPort },
        { container: CONVEX_SITE_PORT, host: siteProxyPort },
      )
      .withLogConsumer((stream) => {
        stream.setEncoding('utf8');
        stream.on('data', (chunk) => {
          containerLogs = `${containerLogs}${chunk}`.slice(-20_000);
          if (debug) process.stderr.write(chunk);
        });
      })
      .withEnvironment({
        CONVEX_CLOUD_ORIGIN: `http://localhost:${CONVEX_BACKEND_PORT}`,
        CONVEX_SITE_ORIGIN: `http://localhost:${CONVEX_SITE_PORT}`,
        DISABLE_BEACON: 'true',
        DISABLE_METRICS_ENDPOINT: 'true',
        DOCUMENT_RETENTION_DELAY: '172800',
        INSTANCE_NAME: instanceName,
        INSTANCE_SECRET: instanceSecret,
        RUST_LOG: process.env.RUST_LOG ?? 'info',
      })
      .start();

    const adminKey = generateAdminKey(container.getId(), instanceName, instanceSecret);
    const runEnv = createRunEnv({
      adminKey,
      backendUrl,
      siteProxyUrl,
      appUrl,
    });

    console.log('[e2e] Setting deployment env vars for the isolated backend...');
    const authSecret = randomBytes(32).toString('hex');
    const envVars: Record<string, string> = {
      SITE_URL: appUrl,
      BETTER_AUTH_SECRET: authSecret,
    };
    const convexFilter = /Can't safely modify|please edit manually/;
    for (const [key, value] of Object.entries(envVars)) {
      result = runBun(['x', 'convex', 'env', 'set', key, value], runEnv, {
        filter: convexFilter,
      });
      if (result.status !== 0 || result.signal) return;
    }

    console.log('[e2e] Pushing Convex functions into the isolated backend...');
    result = runBun(
      [
        'x',
        'convex',
        'dev',
        '--once',
        '--typecheck',
        'disable',
        '--codegen',
        'disable',
        '--tail-logs',
        'disable',
      ],
      runEnv,
      { filter: convexFilter },
    );
    if (result.status !== 0 || result.signal) return;

    console.log(`[e2e] Running Playwright against ${appUrl}...`);
    result = runBun(['run', 'playwright', 'test', ...playwrightArgs], runEnv);
  } catch (error) {
    console.error('[e2e] Failed to provision the isolated test backend.');
    console.error(error);
    if (containerLogs) {
      console.error('[e2e] Backend logs (tail):');
      console.error(containerLogs.trim());
    }
    result = { status: 1, signal: null };
  } finally {
    if (container) {
      console.log('[e2e] Stopping disposable self-hosted Convex backend...');
      try {
        await container.stop({ remove: true, removeVolumes: true });
      } catch (error) {
        console.error('[e2e] Failed to stop the isolated test backend cleanly.');
        console.error(error);
        if (!result || (result.status === 0 && result.signal === null)) {
          result = { status: 1, signal: null };
        }
      }
    }
  }

  exitFrom(result ?? { status: 1, signal: null });
}

await main();
