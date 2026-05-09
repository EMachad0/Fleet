import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import schema from '$convex/schema';
import { modules } from '$convex/test.setup';
import {
  createMembership,
  isMembershipActive,
  listActiveMembershipsByRecency,
  updateMembership,
} from '$convex/_services/membership_lifecycle/memberships';

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

// --- Pure function tests ---

test('isMembershipActive returns true for active membership', () => {
  expect(isMembershipActive({ archivedAt: undefined })).toBe(true);
});

test('isMembershipActive returns false for archived membership', () => {
  expect(isMembershipActive({ archivedAt: 123 })).toBe(false);
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

// --- Ctx-dependent tests ---

test('createMembership inserts a new membership', async () => {
  const t = convexTest(schema, modules);

  const { tenantId, membershipId } = await t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      name: 'Acme',
      uuid: 'test-uuid-1',
      type: 'consumer',
    });
    const membershipId = await createMembership(ctx, {
      userId: 'user-1',
      tenantId,
      role: 'member',
    });
    return { tenantId, membershipId };
  });

  await t.run(async (ctx) => {
    const m = await ctx.db.get(membershipId);
    expect(m).not.toBeNull();
    expect(m!.userId).toBe('user-1');
    expect(m!.tenantId).toBe(tenantId);
    expect(m!.role).toBe('member');
    expect(m!.archivedAt).toBeUndefined();
  });
});

test('createMembership reactivates an archived membership', async () => {
  const t = convexTest(schema, modules);

  const { membershipId } = await t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      name: 'Acme',
      uuid: 'test-uuid-2',
      type: 'consumer',
    });
    const membershipId = await ctx.db.insert('memberships', {
      userId: 'user-1',
      tenantId,
      role: 'member',
      selectedAt: 100,
      archivedAt: 200,
    });
    const reactivatedId = await createMembership(ctx, {
      userId: 'user-1',
      tenantId,
      role: 'admin',
    });
    expect(reactivatedId).toBe(membershipId);
    return { membershipId };
  });

  await t.run(async (ctx) => {
    const m = await ctx.db.get(membershipId);
    expect(m!.archivedAt).toBeUndefined();
    expect(m!.role).toBe('admin');
  });
});

test('createMembership throws if user already has an active membership', async () => {
  const t = convexTest(schema, modules);

  await t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      name: 'Acme',
      uuid: 'test-uuid-3',
      type: 'consumer',
    });
    await ctx.db.insert('memberships', {
      userId: 'user-1',
      tenantId,
      role: 'member',
      selectedAt: 100,
    });

    await expect(
      createMembership(ctx, { userId: 'user-1', tenantId, role: 'admin' }),
    ).rejects.toThrow('User already has an active membership to this tenant');
  });
});

test('updateMembership patches role', async () => {
  const t = convexTest(schema, modules);

  const { membershipId } = await t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      name: 'Acme',
      uuid: 'test-uuid-4',
      type: 'consumer',
    });
    const membershipId = await ctx.db.insert('memberships', {
      userId: 'user-1',
      tenantId,
      role: 'member',
      selectedAt: 100,
    });
    return { membershipId };
  });

  await t.run(async (ctx) => {
    await updateMembership(ctx, { membershipId, patch: { role: 'owner' } });
  });

  await t.run(async (ctx) => {
    const m = await ctx.db.get(membershipId);
    expect(m!.role).toBe('owner');
  });
});

test('updateMembership patches archivedAt', async () => {
  const t = convexTest(schema, modules);

  const { membershipId } = await t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      name: 'Acme',
      uuid: 'test-uuid-5',
      type: 'consumer',
    });
    const membershipId = await ctx.db.insert('memberships', {
      userId: 'user-1',
      tenantId,
      role: 'member',
      selectedAt: 100,
    });
    return { membershipId };
  });

  await t.run(async (ctx) => {
    await updateMembership(ctx, { membershipId, patch: { archivedAt: Date.now() } });
  });

  await t.run(async (ctx) => {
    const m = await ctx.db.get(membershipId);
    expect(m!.archivedAt).toBeDefined();
  });
});

test('updateMembership throws if membership not found', async () => {
  const t = convexTest(schema, modules);

  await t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      name: 'Acme',
      uuid: 'test-uuid-6',
      type: 'consumer',
    });
    const membershipId = await ctx.db.insert('memberships', {
      userId: 'user-1',
      tenantId,
      role: 'member',
      selectedAt: 100,
    });
    await ctx.db.delete(membershipId);

    await expect(updateMembership(ctx, { membershipId, patch: { role: 'admin' } })).rejects.toThrow(
      'Membership not found',
    );
  });
});
