import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { internal } from '$convex/_generated/api';
import schema from '$convex/schema';
import { modules } from '$convex/test.setup';

test('azQuery throws when there is no identity', async () => {
  const t = convexTest(schema, modules);
  await expect(t.query(internal._testing.functions.echoCtx, {})).rejects.toThrow('Unauthenticated');
});

test('azQuery throws when identity has no tenantId', async () => {
  const t = convexTest(schema, modules);

  const noTenant = t.withIdentity({
    subject: 'user|bob',
    name: 'Bob',
    email: 'bob@example.com',
  });

  await expect(noTenant.query(internal._testing.functions.echoCtx, {})).rejects.toThrow(
    'No tenant selected',
  );
});

test('azQuery injects user and tenant from identity claims', async () => {
  const t = convexTest(schema, modules);

  const asAlice = t.withIdentity({
    subject: 'user|alice',
    name: 'Alice',
    email: 'alice@example.com',
    tenantId: 'tenant-123',
    tenantType: 'consumer',
    tenantName: 'Acme',
  });

  const result = await asAlice.query(internal._testing.functions.echoCtx, {});

  expect(result.user).toEqual({
    _id: 'user|alice',
    name: 'Alice',
    email: 'alice@example.com',
  });
  expect(result.tenant).toEqual({
    _id: 'tenant-123',
    type: 'consumer',
    name: 'Acme',
  });
});

test('azQuery passes through admin tenant type', async () => {
  const t = convexTest(schema, modules);

  const asAdmin = t.withIdentity({
    subject: 'user|alice',
    name: 'Alice',
    email: 'alice@example.com',
    tenantId: 'tenant-456',
    tenantType: 'admin',
    tenantName: 'Fleet Ops',
  });

  const result = await asAdmin.query(internal._testing.functions.echoCtx, {});
  expect(result.tenant.type).toBe('admin');
});
