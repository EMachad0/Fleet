import { test, expect } from '../../../support/fixtures';
import { createMembership, createTenant } from '../../../support/convex';

/**
 * What this spec protects:
 *
 *   1. The server guard in `+layout.server.ts` keeps guests out —
 *      unauthenticated visitors are redirected to `/auth/login`.
 *   2. The universal layout guard in `+layout.ts` checks the current
 *      membership's tenant type matches the route segment. A user
 *      whose selected tenant is consumer-type gets a 404 on `/app/admin`.
 *   3. An admin-type tenant user can access admin routes.
 */

test('guest is bounced from admin routes to login', async ({ guestPage }) => {
  await guestPage.goto('/app/admin');
  await expect(guestPage).toHaveURL(/\/auth\/login/);
});

test('consumer tenant user gets 404 on admin routes', async ({
  page,
  user,
  tenant,
  membership,
}) => {
  void user;
  void tenant;
  void membership;

  // Single membership → auto-redirect from select-tenant
  await page.goto('/auth/select-tenant');
  await page.waitForURL(/\/app\/consumer/);
  await page.waitForLoadState('networkidle');

  await page.goto('/app/admin');
  await expect(page.getByText('Not found')).toBeVisible();
});

test('admin tenant user can access the admin dashboard', async ({ page, user }) => {
  const adminTenant = await createTenant({
    name: `Admin ${user.name}`,
    type: 'admin',
  });
  await createMembership({
    userId: user.userId!,
    tenantId: adminTenant._id!,
    role: 'owner',
  });

  // Single membership → auto-redirect from select-tenant
  await page.goto('/auth/select-tenant');
  await page.waitForURL(/\/app\/admin/);
  await page.waitForLoadState('networkidle');

  await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
});
