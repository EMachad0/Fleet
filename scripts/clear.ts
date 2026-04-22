#!/usr/bin/env bun
/**
 * Wipe every row in the dev Convex deployment — app tables AND every
 * installed component (e.g. `@convex-dev/better-auth`). Does NOT reseed.
 * For a full wipe + seed loop, compose: `bun run clear && bun run seed`.
 *
 * Why this lives outside `src/convex/init.ts`:
 *
 * The wipe uses `convex import --replace-all`, whose published semantics
 * are "replace all existing data in the deployment … clearing tables
 * that appear in the schema but not in the import file." In other words,
 * it takes **the deployment's own schema** as the source of truth for
 * which tables exist — including tables defined by installed components,
 * which are nested under `_components/<name>/...` in snapshot zips (see
 * `convex export`).
 *
 * That makes it the only option that DOESN'T require us to maintain a
 * parallel list of table or model names. Options evaluated:
 *
 *   1. Per-table `ctx.db.delete` loops in a Convex mutation.
 *      ❌ Requires enumerating app tables AND the Better Auth
 *         component's internal table list. The component's schema is
 *         not publicly exported, so that list is a hand-copy of its
 *         private ABI — silently wrong after any upgrade that adds a
 *         table.
 *
 *   2. `components.betterAuth.adapter.deleteMany` paginated loop.
 *      ❌ Same problem: the `model` arg is a closed literal union and
 *         needs enumerating; nothing iterates it for us at runtime.
 *
 *   3. Destroy and recreate the deployment.
 *      ❌ Nukes env vars, indexes that are still materializing, dashboard
 *         bookmarks, local CLI state. Way more than we asked for.
 *
 *   4. `convex import --replace-all` with an empty snapshot zip.
 *      ✅ Schema-driven, single call, covers component tables, zero
 *         per-table code, survives component upgrades.
 *
 * The "empty zip" is the 22-byte End-of-Central-Directory record defined
 * by the ZIP spec (PKZIP APPNOTE §4.3.16). We construct it inline so
 * nothing binary is committed to the repo.
 */

import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

// ZIP End-of-Central-Directory record, 22 bytes, zero entries. Signature
// 0x06054b50, all counts and offsets zero, zero-length comment. This is
// the minimal valid ZIP file.
const EMPTY_ZIP = new Uint8Array([
  0x50, 0x4b, 0x05, 0x06, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);

const tmp = mkdtempSync(join(tmpdir(), 'fleet-clear-'));
const zipPath = join(tmp, 'empty.zip');
writeFileSync(zipPath, EMPTY_ZIP);

try {
  const result = spawnSync('bunx', ['convex', 'import', '--replace-all', '--yes', zipPath], {
    stdio: 'inherit',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
