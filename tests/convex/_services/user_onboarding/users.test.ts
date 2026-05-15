import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import schema from '$convex/schema';
import { modules } from '$convex/test.setup';
import { listUsersNotInTenant } from '$convex/_services/user_onboarding/users';

test('listUsersNotInTenant returns empty when all users are active members', async () => {
  const t = convexTest(schema, modules);

  const { tenantId } = await t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      name: 'Acme',
      uuid: 'uuid-1',
      type: 'consumer',
    });
    await ctx.db.insert('memberships', {
      userId: 'user-1',
      tenantId,
      role: 'member',
      selectedAt: 100,
    });
    return { tenantId };
  });

  const result = await t.run(async (ctx) => {
    return listUsersNotInTenant(ctx, { targetTenantId: tenantId });
  });

  expect(result).toEqual([]);
});

test('listUsersNotInTenant returns empty when no memberships exist', async () => {
  const t = convexTest(schema, modules);

  const { tenantId } = await t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      name: 'Acme',
      uuid: 'uuid-1',
      type: 'consumer',
    });
    return { tenantId };
  });

  const result = await t.run(async (ctx) => {
    return listUsersNotInTenant(ctx, { targetTenantId: tenantId });
  });

  expect(result).toEqual([]);
});
