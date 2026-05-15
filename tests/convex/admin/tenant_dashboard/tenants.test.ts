import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from '$convex/_generated/api';
import schema from '$convex/schema';
import { modules } from '$convex/test.setup';

const adminIdentity = {
  subject: 'user|admin',
  name: 'Admin',
  email: 'admin@example.com',
  tenantId: 'tenant-admin',
  tenantType: 'admin',
  tenantName: 'Fleet Ops',
};

const consumerIdentity = {
  subject: 'user|consumer',
  name: 'Consumer',
  email: 'consumer@example.com',
  tenantId: 'tenant-consumer',
  tenantType: 'consumer',
  tenantName: 'Acme',
};

test('listTenants rejects unauthenticated caller', async () => {
  const t = convexTest(schema, modules);
  await expect(t.query(api.admin.tenant_dashboard.tenants.listTenants, {})).rejects.toThrow(
    'Unauthenticated',
  );
});

test('listTenants rejects non-admin caller', async () => {
  const t = convexTest(schema, modules);
  const asConsumer = t.withIdentity(consumerIdentity);
  await expect(
    asConsumer.query(api.admin.tenant_dashboard.tenants.listTenants, {}),
  ).rejects.toThrow('Not an admin');
});

test('createTenant rejects unauthenticated caller', async () => {
  const t = convexTest(schema, modules);
  await expect(
    t.mutation(api.admin.tenant_dashboard.tenants.createTenant, {
      name: 'Test',
      type: 'consumer',
    }),
  ).rejects.toThrow('Unauthenticated');
});

test('createTenant rejects non-admin caller', async () => {
  const t = convexTest(schema, modules);
  const asConsumer = t.withIdentity(consumerIdentity);
  await expect(
    asConsumer.mutation(api.admin.tenant_dashboard.tenants.createTenant, {
      name: 'Test',
      type: 'consumer',
    }),
  ).rejects.toThrow('Not an admin');
});

test('listTenants returns tenants with active and total member counts', async () => {
  const t = convexTest(schema, modules);

  await t.run(async (ctx) => {
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
    await ctx.db.insert('memberships', {
      userId: 'user-2',
      tenantId,
      role: 'member',
      selectedAt: 200,
      archivedAt: 300,
    });
  });

  const asAdmin = t.withIdentity(adminIdentity);
  const tenants = await asAdmin.query(api.admin.tenant_dashboard.tenants.listTenants, {});

  expect(tenants).toHaveLength(1);
  expect(tenants[0].name).toBe('Acme');
  expect(tenants[0].memberCount).toBe(1);
  expect(tenants[0].totalMemberCount).toBe(2);
});

test('createTenant creates a tenant through the admin wrapper', async () => {
  const t = convexTest(schema, modules);
  const asAdmin = t.withIdentity(adminIdentity);

  const tenantId = await asAdmin.mutation(api.admin.tenant_dashboard.tenants.createTenant, {
    name: 'NewCo',
    type: 'contractor',
  });

  await t.run(async (ctx) => {
    const tenant = await ctx.db.get(tenantId);
    expect(tenant).not.toBeNull();
    expect(tenant!.name).toBe('NewCo');
    expect(tenant!.type).toBe('contractor');
    expect(tenant!.uuid).toBeTruthy();
  });
});
