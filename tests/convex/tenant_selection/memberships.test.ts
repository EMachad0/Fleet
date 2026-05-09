import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from '$convex/_generated/api';
import schema from '$convex/schema';
import { modules } from '$convex/test.setup';

test('getCurrentMembership rejects unauthenticated caller', async () => {
  const t = convexTest(schema, modules);
  await expect(
    t.query(api.tenant_selection.memberships.getCurrentMembership, {}),
  ).rejects.toThrow();
});

test('getCurrentMembership rejects caller without tenant selected', async () => {
  const t = convexTest(schema, modules);
  const asUser = t.withIdentity({
    subject: 'user|alice',
    name: 'Alice',
    email: 'alice@example.com',
  });
  await expect(
    asUser.query(api.tenant_selection.memberships.getCurrentMembership, {}),
  ).rejects.toThrow();
});

test('selectMembership rejects unauthenticated caller', async () => {
  const t = convexTest(schema, modules);

  const { membershipId } = await t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      name: 'Acme',
      uuid: 'test-uuid',
      type: 'consumer',
    });
    const membershipId = await ctx.db.insert('memberships', {
      userId: 'user|alice',
      tenantId,
      role: 'member',
      selectedAt: 100,
    });
    return { membershipId };
  });

  await expect(
    t.mutation(api.tenant_selection.memberships.selectMembership, { membershipId }),
  ).rejects.toThrow();
});
