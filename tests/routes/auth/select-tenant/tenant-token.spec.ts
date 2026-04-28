import { decodeJwt } from 'jose';
import { test, expect } from '../../../support/fixtures';
import { createMembership, createTenant } from '../../../support/convex';

async function fetchConvexJwtViaApi(page: import('@playwright/test').Page, origin: string) {
  const res = await page.request.get('/api/auth/convex/token', {
    headers: { origin },
  });
  if (!res.ok()) return undefined;
  const body = await res.json();
  return body.token as string | undefined;
}

test('selecting a tenant on the picker sets tenantId on the JWT', async ({
  page,
  user,
  tenant,
  membership,
}) => {
  void membership;

  const secondTenant = await createTenant({
    name: 'Second Workspace',
    type: 'contractor',
  });
  await createMembership({
    userId: user.userId!,
    tenantId: secondTenant._id!,
    role: 'member',
  });

  await page.goto('/auth/select-tenant', { waitUntil: 'networkidle' });

  await expect(page.getByText('Choose a workspace')).toBeVisible();

  await page.getByRole('radio', { name: tenant.name }).check();
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.waitForURL(/\/app\//);
  await page.waitForLoadState('networkidle');

  const token = await fetchConvexJwtViaApi(page, page.url());
  expect(token, 'JWT token should be returned from /api/auth/convex/token').toBeTruthy();

  const payload = decodeJwt(token!);
  expect(payload.tenantId).toBe(tenant._id);
});

test('switching tenants via header works end-to-end', async ({
  page,
  user,
  tenant,
  membership,
}) => {
  void membership;

  const secondTenant = await createTenant({
    name: 'Second Workspace',
    type: 'contractor',
  });
  await createMembership({
    userId: user.userId!,
    tenantId: secondTenant._id!,
    role: 'member',
  });

  await page.goto('/auth/select-tenant', { waitUntil: 'networkidle' });
  await page.getByRole('radio', { name: tenant.name }).check();
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.waitForURL(/\/app\/consumer/);
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: `Welcome to ${tenant.name}` })).toBeVisible();

  await page.getByRole('link', { name: 'Switch' }).click();
  await expect(page).toHaveURL(/\/auth\/select-tenant/);

  await page.getByRole('radio', { name: secondTenant.name }).check();
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.waitForURL(/\/app\/contractor/);
  await page.waitForLoadState('networkidle');
  await expect(
    page.getByRole('heading', { name: `Welcome to ${secondTenant.name}` }),
  ).toBeVisible();
});

test('tenant-less user hitting /app/* is redirected to the picker', async ({ page }) => {
  await page.goto('/app/consumer');
  await expect(page).toHaveURL(/\/auth\/select-tenant/);
  await expect(page.getByText('Choose a workspace')).toBeVisible();
  await expect(page.getByText(/isn't part of any workspace yet/)).toBeVisible();
});

test('single-membership user is auto-redirected and JWT has tenantId', async ({
  page,
  tenant,
  membership,
}) => {
  void membership;

  await page.goto('/auth/select-tenant');

  await page.waitForURL(/\/app\//);
  await page.waitForLoadState('networkidle');

  const token = await fetchConvexJwtViaApi(page, page.url());
  expect(token, 'JWT token should be returned from /api/auth/convex/token').toBeTruthy();

  const payload = decodeJwt(token!);
  expect(payload.tenantId).toBe(tenant._id);
});
