import { expect, test } from 'vitest';
import { assertMembershipCanBeSelected, listActiveMembershipsByRecency } from './memberships';

type FixtureMembership = {
  id: string;
  userId: string;
  selectedAt: number;
  archivedAt?: number;
};

const membership = (
  id: string,
  selectedAt: number,
  opts?: { userId?: string; archivedAt?: number },
): FixtureMembership => ({
  id,
  userId: opts?.userId ?? 'user-1',
  selectedAt,
  ...(opts?.archivedAt === undefined ? {} : { archivedAt: opts.archivedAt }),
});

test('listActiveMembershipsByRecency filters archived memberships and sorts by selectedAt desc', () => {
  const memberships = [
    membership('older-active', 10),
    membership('archived', 999, { archivedAt: 123 }),
    membership('newer-active', 20),
  ];

  const result = listActiveMembershipsByRecency(memberships);

  expect(result.map((m) => m.id)).toEqual(['newer-active', 'older-active']);
  expect(memberships.map((m) => m.id)).toEqual(['older-active', 'archived', 'newer-active']);
});

test('assertMembershipCanBeSelected accepts an active membership owned by the caller', () => {
  expect(() => {
    assertMembershipCanBeSelected({ userId: 'user-1' }, 'user-1');
  }).not.toThrow();
});

test('assertMembershipCanBeSelected rejects a missing membership', () => {
  expect(() => {
    assertMembershipCanBeSelected(null, 'user-1');
  }).toThrow('Not a member of that tenant');
});

test("assertMembershipCanBeSelected rejects another user's membership", () => {
  expect(() => {
    assertMembershipCanBeSelected({ userId: 'user-2' }, 'user-1');
  }).toThrow('Not a member of that tenant');
});

test('assertMembershipCanBeSelected rejects archived memberships', () => {
  expect(() => {
    assertMembershipCanBeSelected({ userId: 'user-1', archivedAt: 123 }, 'user-1');
  }).toThrow('That workspace is archived');
});
