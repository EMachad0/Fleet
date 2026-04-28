import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';
import { modules } from './test.setup';

test('adminQuery throws when tenant type is not admin', async () => {
  const t = convexTest(schema, modules);

  const asConsumer = t.withIdentity({
    subject: 'user|alice',
    name: 'Alice',
    email: 'alice@example.com',
    tenantId: 'tenant-123',
    tenantType: 'consumer',
    tenantName: 'Acme',
  });

  await expect(asConsumer.query(api.functions_test_helper.echoAdminCtx, {})).rejects.toThrow(
    'Not an admin',
  );
});

test('adminQuery passes when tenant type is admin', async () => {
  const t = convexTest(schema, modules);

  const asAdmin = t.withIdentity({
    subject: 'user|alice',
    name: 'Alice',
    email: 'alice@example.com',
    tenantId: 'tenant-456',
    tenantType: 'admin',
    tenantName: 'Fleet Ops',
  });

  const result = await asAdmin.query(api.functions_test_helper.echoAdminCtx, {});
  expect(result.tenant.type).toBe('admin');
});

test('azQuery throws when identity has no tenantId', async () => {
  const t = convexTest(schema, modules);

  const noTenant = t.withIdentity({
    subject: 'user|bob',
    name: 'Bob',
    email: 'bob@example.com',
  });

  await expect(noTenant.query(api.functions_test_helper.echoAuthedCtx, {})).rejects.toThrow(
    'No tenant selected',
  );
});

test('azQuery throws when there is no identity', async () => {
  const t = convexTest(schema, modules);
  await expect(t.query(api.functions_test_helper.echoAuthedCtx, {})).rejects.toThrow(
    'Unauthenticated',
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

  const result = await asAlice.query(api.functions_test_helper.echoAuthedCtx, {});

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
