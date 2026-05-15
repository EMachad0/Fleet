import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from '$convex/_generated/api';
import schema from '$convex/schema';
import { modules } from '$convex/test.setup';

const consumerIdentity = {
  subject: 'user|consumer',
  name: 'Consumer',
  email: 'consumer@example.com',
  tenantId: 'tenant-consumer',
  tenantType: 'consumer',
  tenantName: 'Acme',
};

test('listUsers rejects unauthenticated caller', async () => {
  const t = convexTest(schema, modules);
  await expect(t.query(api.admin.membership_dashboard.users.listUsers, {})).rejects.toThrow(
    'Unauthenticated',
  );
});

test('listUsers rejects non-admin caller', async () => {
  const t = convexTest(schema, modules);
  const asConsumer = t.withIdentity(consumerIdentity);
  await expect(
    asConsumer.query(api.admin.membership_dashboard.users.listUsers, {}),
  ).rejects.toThrow('Not an admin');
});

test('listUsersNotInTenant rejects unauthenticated caller', async () => {
  const t = convexTest(schema, modules);

  const { tenantId } = await t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      name: 'Acme',
      uuid: 'uuid-1',
      type: 'consumer',
    });
    return { tenantId };
  });

  await expect(
    t.query(api.admin.membership_dashboard.users.listUsersNotInTenant, {
      targetTenantId: tenantId,
    }),
  ).rejects.toThrow('Unauthenticated');
});

test('listUsersNotInTenant rejects non-admin caller', async () => {
  const t = convexTest(schema, modules);

  const { tenantId } = await t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      name: 'Acme',
      uuid: 'uuid-1',
      type: 'consumer',
    });
    return { tenantId };
  });

  const asConsumer = t.withIdentity(consumerIdentity);
  await expect(
    asConsumer.query(api.admin.membership_dashboard.users.listUsersNotInTenant, {
      targetTenantId: tenantId,
    }),
  ).rejects.toThrow('Not an admin');
});

test('createUser rejects unauthenticated caller', async () => {
  const t = convexTest(schema, modules);
  await expect(
    t.action(api.admin.membership_dashboard.users.createUser, {
      email: 'test@example.com',
      name: 'Test',
      password: 'password123',
    }),
  ).rejects.toThrow('Unauthenticated');
});

test('createUser rejects non-admin caller', async () => {
  const t = convexTest(schema, modules);
  const asConsumer = t.withIdentity(consumerIdentity);
  await expect(
    asConsumer.action(api.admin.membership_dashboard.users.createUser, {
      email: 'test@example.com',
      name: 'Test',
      password: 'password123',
    }),
  ).rejects.toThrow('Not an admin');
});
