import { test, expect } from '../../../support/fixtures';
import { createMembership, createTenant } from '../../../support/convex';

function decodeJwtPayload(token: string): Record<string, unknown> {
  const [, payloadB64] = token.split('.');
  if (!payloadB64) return {};
  return JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
}

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
    slug: `second-${Date.now()}`,
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

  const payload = decodeJwtPayload(token!);
  expect(payload.tenantId).toBe(tenant._id);
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

  const payload = decodeJwtPayload(token!);
  expect(payload.tenantId).toBe(tenant._id);
});
