import { expect, test } from 'vitest';
import { pickOnlyActiveMembership } from './auth';

type FixtureMembership = { tenantId: string; archivedAt?: number };

const membership = (tenantId: string, archivedAt?: number): FixtureMembership =>
  archivedAt === undefined ? { tenantId } : { tenantId, archivedAt };

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
