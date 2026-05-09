import { expect, test } from 'vitest';
import { buildConvexJwtPayload } from '$convex/auth';

test('buildConvexJwtPayload includes tenant fields from session', () => {
  const payload = buildConvexJwtPayload({
    user: { id: 'user-1', name: 'Alice', email: 'alice@example.com', image: 'pic.jpg' },
    session: { tenantId: 'tenant-123', tenantType: 'consumer', tenantName: 'Acme', role: 'owner' },
  });

  expect(payload.tenantId).toBe('tenant-123');
  expect(payload.tenantType).toBe('consumer');
  expect(payload.tenantName).toBe('Acme');
  expect(payload.role).toBe('owner');
  expect(payload.name).toBe('Alice');
  expect(payload.email).toBe('alice@example.com');
  expect(payload).not.toHaveProperty('id');
  expect(payload).not.toHaveProperty('image');
});

test('buildConvexJwtPayload has undefined tenant fields when session has none', () => {
  const payload = buildConvexJwtPayload({
    user: { id: 'user-1', name: 'Bob', email: 'bob@example.com' },
    session: {},
  });

  expect(payload.tenantId).toBeUndefined();
  expect(payload.tenantType).toBeUndefined();
  expect(payload.tenantName).toBeUndefined();
  expect(payload.name).toBe('Bob');
});
