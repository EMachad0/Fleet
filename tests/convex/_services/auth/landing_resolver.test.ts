import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import schema from '$convex/schema';
import { modules } from '$convex/test.setup';
import { resolveDefaultLanding } from '$convex/_services/auth/landing_resolver';

test('returns null when user has no memberships', async () => {
  const t = convexTest(schema, modules);

  await t.run(async (ctx) => {
    const result = await resolveDefaultLanding(ctx, 'user-1');
    expect(result).toBeNull();
  });
});

test('returns landing info when user has exactly one active membership', async () => {
  const t = convexTest(schema, modules);

  await t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      name: 'Acme',
      uuid: 'test-uuid-1',
      type: 'consumer',
    });
    await ctx.db.insert('memberships', {
      userId: 'user-1',
      tenantId,
      role: 'owner',
      selectedAt: 100,
    });

    const result = await resolveDefaultLanding(ctx, 'user-1');
    expect(result).toEqual({
      type: 'consumer',
      name: 'Acme',
      tenantId,
      role: 'owner',
    });
  });
});

test('returns null when user has multiple active memberships', async () => {
  const t = convexTest(schema, modules);

  await t.run(async (ctx) => {
    const tenantA = await ctx.db.insert('tenants', {
      name: 'Acme',
      uuid: 'test-uuid-2a',
      type: 'consumer',
    });
    const tenantB = await ctx.db.insert('tenants', {
      name: 'Beta',
      uuid: 'test-uuid-2b',
      type: 'contractor',
    });
    await ctx.db.insert('memberships', {
      userId: 'user-1',
      tenantId: tenantA,
      role: 'member',
      selectedAt: 100,
    });
    await ctx.db.insert('memberships', {
      userId: 'user-1',
      tenantId: tenantB,
      role: 'member',
      selectedAt: 200,
    });

    const result = await resolveDefaultLanding(ctx, 'user-1');
    expect(result).toBeNull();
  });
});

test('returns null when all memberships are archived', async () => {
  const t = convexTest(schema, modules);

  await t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      name: 'Acme',
      uuid: 'test-uuid-3',
      type: 'consumer',
    });
    await ctx.db.insert('memberships', {
      userId: 'user-1',
      tenantId,
      role: 'member',
      selectedAt: 100,
      archivedAt: 200,
    });

    const result = await resolveDefaultLanding(ctx, 'user-1');
    expect(result).toBeNull();
  });
});

test('returns the one active membership when archived ones also exist', async () => {
  const t = convexTest(schema, modules);

  await t.run(async (ctx) => {
    const activeTenant = await ctx.db.insert('tenants', {
      name: 'Active Corp',
      uuid: 'test-uuid-4a',
      type: 'contractor',
    });
    const archivedTenant = await ctx.db.insert('tenants', {
      name: 'Old Corp',
      uuid: 'test-uuid-4b',
      type: 'consumer',
    });
    await ctx.db.insert('memberships', {
      userId: 'user-1',
      tenantId: archivedTenant,
      role: 'member',
      selectedAt: 50,
      archivedAt: 150,
    });
    await ctx.db.insert('memberships', {
      userId: 'user-1',
      tenantId: activeTenant,
      role: 'admin',
      selectedAt: 100,
    });

    const result = await resolveDefaultLanding(ctx, 'user-1');
    expect(result).toEqual({
      type: 'contractor',
      name: 'Active Corp',
      tenantId: activeTenant,
      role: 'admin',
    });
  });
});
