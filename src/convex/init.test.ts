import { convexTest } from 'convex-test';
import { afterEach, expect, test, vi } from 'vitest';
import { internal } from './_generated/api';
import schema from './schema';
import { modules } from './test.setup';

afterEach(() => {
  vi.restoreAllMocks();
});

test('applyFixtures stamps selectedAt on every seeded membership', async () => {
  const t = convexTest(schema, modules);
  const stamp = 1_700_000_000_000;
  vi.spyOn(Date, 'now').mockReturnValue(stamp);

  await t.mutation(internal.init.applyFixtures, {
    userIdByEmail: {
      'elitonmachadod200@gmail.com': 'user|seed',
    },
  });

  const memberships = await t.run((ctx) => ctx.db.query('memberships').collect());

  expect(memberships).toHaveLength(2);
  expect(memberships.every((m) => m.selectedAt === stamp)).toBe(true);
});
