#!/usr/bin/env bun
import { resolve } from 'node:path';
import { generatePorts, getClaimedOffsets } from './lib/ports.ts';

const ENV_PATH = resolve(import.meta.dirname, '..', '.env');
const PARENT_DIR = resolve(import.meta.dirname, '..', '..');

function parseArgs(): { mode: 'offset'; offset: number } | { mode: 'auto' } {
  if (process.argv.includes('--auto')) return { mode: 'auto' };

  const offsetIndex = process.argv.indexOf('--offset');
  if (offsetIndex === -1 || offsetIndex + 1 >= process.argv.length) {
    console.error('Usage: bun scripts/generate-ports.ts --offset <N>');
    console.error('       bun scripts/generate-ports.ts --auto');
    console.error('  --offset <N>  non-negative integer port offset (0 is permitted)');
    console.error('  --auto        automatically find the first available offset');
    process.exit(1);
  }

  const raw = process.argv[offsetIndex + 1];
  const offset = Number(raw);
  if (!Number.isInteger(offset) || offset < 0) {
    console.error(`Error: offset must be a non-negative integer, got "${raw}"`);
    process.exit(1);
  }

  return { mode: 'offset', offset };
}

async function main() {
  const args = parseArgs();

  try {
    const { offset, entries } = await generatePorts(
      args.mode === 'auto'
        ? { mode: 'auto', envPath: ENV_PATH, excludeOffsets: getClaimedOffsets(PARENT_DIR) }
        : { mode: 'offset', offset: args.offset, envPath: ENV_PATH },
    );

    if (args.mode === 'auto') console.log(`Selected offset: ${offset}`);
    console.log('Wrote port variables to .env:');
    for (const [key, value] of Object.entries(entries)) {
      console.log(`  ${key}=${value}`);
    }
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

main();
