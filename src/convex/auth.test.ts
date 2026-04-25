import { expect, test } from 'vitest';
import { buildConvexJwtPayload, pickOnlyActiveMembership } from './auth';

type FixtureMembership = { tenantId: string; archivedAt?: number };

const membership = (tenantId: string, archivedAt?: number): FixtureMembership =>
  archivedAt === undefined ? { tenantId } : { tenantId, archivedAt };

test('buildConvexJwtPayload includes tenantId from session', () => {
  const payload = buildConvexJwtPayload({
    user: { id: 'user-1', name: 'Alice', email: 'alice@example.com', image: 'pic.jpg' },
    session: { tenantId: 'tenant-123' },
  });

  expect(payload.tenantId).toBe('tenant-123');
  expect(payload.name).toBe('Alice');
  expect(payload.email).toBe('alice@example.com');
  expect(payload).not.toHaveProperty('id');
  expect(payload).not.toHaveProperty('image');
});

test('buildConvexJwtPayload has undefined tenantId when session has none', () => {
  const payload = buildConvexJwtPayload({
    user: { id: 'user-1', name: 'Bob', email: 'bob@example.com' },
    session: {},
  });

  expect(payload.tenantId).toBeUndefined();
  expect(payload.name).toBe('Bob');
  expect(payload.email).toBe('bob@example.com');
});

test('returns null when there are no memberships', () => {
  expect(pickOnlyActiveMembership([])).toBeNull();
});

test('returns the one active membership when archived rows also exist', () => {
  const result = pickOnlyActiveMembership([
    membership('archived-a', 1),
    membership('active'),
    membership('archived-b', 2),
  ]);

  expect(result).toEqual({ tenantId: 'active' });
});

test('returns null when there are multiple active memberships', () => {
  const result = pickOnlyActiveMembership([membership('a'), membership('b')]);

  expect(result).toBeNull();
});

test('returns null when all memberships are archived', () => {
  const result = pickOnlyActiveMembership([membership('a', 1), membership('b', 2)]);

  expect(result).toBeNull();
});
