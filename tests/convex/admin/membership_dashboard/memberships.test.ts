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

test('createMembership rejects unauthenticated caller', async () => {
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
    t.mutation(api.admin.membership_dashboard.memberships.createMembership, {
      userId: 'user-1',
      targetTenantId: tenantId,
      role: 'member',
    }),
  ).rejects.toThrow('Unauthenticated');
});

test('createMembership rejects non-admin caller', async () => {
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
    asConsumer.mutation(api.admin.membership_dashboard.memberships.createMembership, {
      userId: 'user-1',
      targetTenantId: tenantId,
      role: 'member',
    }),
  ).rejects.toThrow('Not an admin');
});

test('archiveMembership rejects unauthenticated caller', async () => {
  const t = convexTest(schema, modules);

  const { membershipId } = await t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      name: 'Acme',
      uuid: 'uuid-1',
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

  await expect(
    t.mutation(api.admin.membership_dashboard.memberships.archiveMembership, {
      membershipId,
    }),
  ).rejects.toThrow('Unauthenticated');
});

test('archiveMembership rejects non-admin caller', async () => {
  const t = convexTest(schema, modules);

  const { membershipId } = await t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      name: 'Acme',
      uuid: 'uuid-1',
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

  const asConsumer = t.withIdentity(consumerIdentity);
  await expect(
    asConsumer.mutation(api.admin.membership_dashboard.memberships.archiveMembership, {
      membershipId,
    }),
  ).rejects.toThrow('Not an admin');
});

test('updateMembershipRole rejects unauthenticated caller', async () => {
  const t = convexTest(schema, modules);

  const { membershipId } = await t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      name: 'Acme',
      uuid: 'uuid-1',
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

  await expect(
    t.mutation(api.admin.membership_dashboard.memberships.updateMembershipRole, {
      membershipId,
      role: 'admin',
    }),
  ).rejects.toThrow('Unauthenticated');
});

test('updateMembershipRole rejects non-admin caller', async () => {
  const t = convexTest(schema, modules);

  const { membershipId } = await t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      name: 'Acme',
      uuid: 'uuid-1',
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

  const asConsumer = t.withIdentity(consumerIdentity);
  await expect(
    asConsumer.mutation(api.admin.membership_dashboard.memberships.updateMembershipRole, {
      membershipId,
      role: 'admin',
    }),
  ).rejects.toThrow('Not an admin');
});

test('createMembership creates a membership through the admin wrapper', async () => {
  const t = convexTest(schema, modules);

  const { tenantId } = await t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      name: 'Acme',
      uuid: 'uuid-1',
      type: 'consumer',
    });
    return { tenantId };
  });

  const asAdmin = t.withIdentity(adminIdentity);
  const membershipId = await asAdmin.mutation(
    api.admin.membership_dashboard.memberships.createMembership,
    { userId: 'user-1', targetTenantId: tenantId, role: 'member' },
  );

  await t.run(async (ctx) => {
    const membership = await ctx.db.get(membershipId);
    expect(membership).not.toBeNull();
    expect(membership!.userId).toBe('user-1');
    expect(membership!.role).toBe('member');
  });
});

test('archiveMembership sets archivedAt through the admin wrapper', async () => {
  const t = convexTest(schema, modules);

  const { membershipId } = await t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      name: 'Acme',
      uuid: 'uuid-1',
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

  const asAdmin = t.withIdentity(adminIdentity);
  await asAdmin.mutation(api.admin.membership_dashboard.memberships.archiveMembership, {
    membershipId,
  });

  await t.run(async (ctx) => {
    const membership = await ctx.db.get(membershipId);
    expect(membership!.archivedAt).toBeDefined();
  });
});

test('updateMembershipRole updates role through the admin wrapper', async () => {
  const t = convexTest(schema, modules);

  const { membershipId } = await t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      name: 'Acme',
      uuid: 'uuid-1',
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

  const asAdmin = t.withIdentity(adminIdentity);
  await asAdmin.mutation(api.admin.membership_dashboard.memberships.updateMembershipRole, {
    membershipId,
    role: 'admin',
  });

  await t.run(async (ctx) => {
    const membership = await ctx.db.get(membershipId);
    expect(membership!.role).toBe('admin');
  });
});
