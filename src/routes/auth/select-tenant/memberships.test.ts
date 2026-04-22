import { expect, test } from 'vitest';
import { groupMembershipsByType } from './memberships';
import type { TenantType } from '$lib/schemas/auth';

/**
 * Minimal membership shape for these tests. The helper is generic over
 * `{ tenant: { type } }`, so we use this local stand-in instead of
 * importing the full Convex return type and coupling these unit tests
 * to the data layer's shape.
 */
type Fixture = { id: string; tenant: { type: TenantType } };

const m = (id: string, type: TenantType): Fixture => ({ id, tenant: { type } });

test('returns groups in the order declared by tenantTypeSchema', () => {
  // Input is deliberately in reverse canonical order to prove the helper
  // imposes the schema's order rather than just reflecting insertion.
  const groups = groupMembershipsByType([m('a', 'contractor'), m('b', 'consumer')]);

  expect(groups.map((g) => g.type)).toEqual(['consumer', 'contractor']);
});

test('drops tenant types with zero memberships', () => {
  const groups = groupMembershipsByType([m('only', 'consumer')]);

  expect(groups).toEqual([
    {
      type: 'consumer',
      memberships: [{ id: 'only', tenant: { type: 'consumer' } }],
    },
  ]);
});

test('preserves membership order within each group', () => {
  // Stable order inside a bucket matters for the radio-button list in
  // `+page.svelte`: users expect the list not to shuffle between
  // live-subscription ticks.
  const groups = groupMembershipsByType([
    m('first', 'consumer'),
    m('second', 'consumer'),
    m('third', 'consumer'),
  ]);

  expect(groups[0]!.memberships.map((x) => x.id)).toEqual(['first', 'second', 'third']);
});

test('returns an empty array when there are no memberships', () => {
  expect(groupMembershipsByType([])).toEqual([]);
});
