import { convexTest } from 'convex-test';
import { afterEach, expect, test, vi } from 'vitest';
import { internal } from '$convex/_generated/api';
import { SEED_MEMBERSHIPS, SEED_USERS } from '$convex/init';
import schema from '$convex/schema';
import { modules } from '$convex/test.setup';

afterEach(() => {
  vi.restoreAllMocks();
});

test('applyFixtures stamps selectedAt on every seeded membership', async () => {
  const t = convexTest(schema, modules);
  const stamp = 1_700_000_000_000;
  vi.spyOn(Date, 'now').mockReturnValue(stamp);

  const userIdByEmail = Object.fromEntries(
    SEED_USERS.map((u) => [u.email, `user|seed-${u.email}`]),
  );

  await t.mutation(internal.init.applyFixtures, { userIdByEmail });

  const memberships = await t.run((ctx) => ctx.db.query('memberships').collect());

  expect(memberships).toHaveLength(SEED_MEMBERSHIPS.length);
  expect(memberships.every((m) => m.selectedAt === stamp)).toBe(true);
});
