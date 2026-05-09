import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import schema from '$convex/schema';
import { modules } from '$convex/test.setup';
import { createTenant } from '$convex/_services/tenant_provisioning/tenants';

test('createTenant inserts a tenant with a generated UUID', async () => {
  const t = convexTest(schema, modules);

  const tenantId = await t.run(async (ctx) => {
    return createTenant(ctx, { name: 'Acme', type: 'consumer' });
  });

  await t.run(async (ctx) => {
    const tenant = await ctx.db.get(tenantId);
    expect(tenant).not.toBeNull();
    expect(tenant!.name).toBe('Acme');
    expect(tenant!.type).toBe('consumer');
    expect(tenant!.uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});

test('createTenant generates unique UUIDs for each tenant', async () => {
  const t = convexTest(schema, modules);

  const [id1, id2] = await t.run(async (ctx) => {
    const a = await createTenant(ctx, { name: 'Alpha', type: 'consumer' });
    const b = await createTenant(ctx, { name: 'Beta', type: 'contractor' });
    return [a, b] as const;
  });

  await t.run(async (ctx) => {
    const t1 = await ctx.db.get(id1);
    const t2 = await ctx.db.get(id2);
    expect(t1!.uuid).not.toBe(t2!.uuid);
  });
});
