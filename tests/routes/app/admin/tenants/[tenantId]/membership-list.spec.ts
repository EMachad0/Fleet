import { randomBytes } from 'node:crypto';
import type { Page } from '@playwright/test';
import { test, expect } from '../../../../../support/fixtures';
import {
  createMembership,
  createTenant,
  createUser,
  type TestTenant,
  type TestUser,
} from '../../../../../support/convex';

/**
 * What this spec protects:
 *
 *   The decomposed membership-list component on the admin tenant detail
 *   page (`/app/admin/tenants/[tenantId]`). After the refactor in #58,
 *   the monolith was split into:
 *
 *   - `active-member-list` — search, archive/role mutations, error state
 *   - `add-member-form` — Superforms-based form, candidates query
 *   - parent — layout, archived section
 *
 *   These tests lock in all interactive behaviors end-to-end: rendering,
 *   search, role changes, archiving, and the add-member flow with
 *   Superforms validation.
 */

type SetupResult = {
  adminTenant: TestTenant;
  targetTenant: TestTenant;
  seedUsers: TestUser[];
};

async function setupAdminWithTargetTenant(
  page: Page,
  testUser: TestUser,
  seedCount = 2,
): Promise<SetupResult> {
  const id = randomBytes(6).toString('hex');

  const adminTenant = await createTenant({ name: `Admin ${id}`, type: 'admin' });
  await createMembership({
    userId: testUser.userId!,
    tenantId: adminTenant._id!,
    role: 'owner',
  });

  const targetTenant = await createTenant({ name: `Target ${id}`, type: 'consumer' });

  const seedUsers: TestUser[] = [];
  for (let i = 0; i < seedCount; i++) {
    const uid = randomBytes(6).toString('hex');
    const u = await createUser({
      email: `seed-${uid}@test.local`,
      password: `pw-${uid}`,
      name: `Seed User ${uid}`,
    });
    seedUsers.push(u);
    await createMembership({
      userId: u.userId!,
      tenantId: targetTenant._id!,
      role: i === 0 ? 'admin' : 'member',
    });
  }

  // Single membership → auto-redirect from select-tenant
  await page.goto('/auth/select-tenant');
  await page.waitForURL(/\/app\/admin/);
  await page.waitForLoadState('networkidle');

  return { adminTenant, targetTenant, seedUsers };
}

async function goToMembershipsTab(page: Page, tenantId: string) {
  await page.goto(`/app/admin/tenants/${tenantId}`, { waitUntil: 'networkidle' });
  await page.getByRole('tab', { name: 'Memberships' }).click();
}

test('tenant detail page renders with Dashboard and Memberships tabs', async ({ page, user }) => {
  const { targetTenant } = await setupAdminWithTargetTenant(page, user);

  await page.goto(`/app/admin/tenants/${targetTenant._id}`, { waitUntil: 'networkidle' });

  await expect(page.getByRole('heading', { name: targetTenant.name })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Memberships' })).toBeVisible();
  await expect(page.getByText('Details')).toBeVisible();
  await expect(page.getByText('Membership breakdown')).toBeVisible();
});

test('active members list renders with correct count', async ({ page, user }) => {
  const { targetTenant, seedUsers } = await setupAdminWithTargetTenant(page, user);

  await goToMembershipsTab(page, targetTenant._id!);

  await expect(page.getByText(`Members (${seedUsers.length})`)).toBeVisible();
  for (const u of seedUsers) {
    await expect(page.getByText(u.name)).toBeVisible();
    await expect(page.getByText(u.email)).toBeVisible();
  }
});

test('search filters members by name', async ({ page, user }) => {
  const { targetTenant, seedUsers } = await setupAdminWithTargetTenant(page, user);

  await goToMembershipsTab(page, targetTenant._id!);

  // Open search
  const searchToggle = page.locator('button:has(svg)').first();
  await searchToggle.click();

  const searchInput = page.getByPlaceholder('Search by name or email...');
  await expect(searchInput).toBeVisible();

  // Filter to first seed user by name
  const target = seedUsers[0];
  await searchInput.fill(target.name);
  await expect(page.getByText(target.name)).toBeVisible();
  // Other user should be hidden
  await expect(page.getByText(seedUsers[1].name)).toBeHidden();

  // No-match query
  await searchInput.fill('zzz-no-match-zzz');
  await expect(page.getByText('No members match your search.')).toBeVisible();
});

test('search filters members by email', async ({ page, user }) => {
  const { targetTenant, seedUsers } = await setupAdminWithTargetTenant(page, user);

  await goToMembershipsTab(page, targetTenant._id!);

  const searchToggle = page.locator('button:has(svg)').first();
  await searchToggle.click();

  const searchInput = page.getByPlaceholder('Search by name or email...');
  const target = seedUsers[0];
  await searchInput.fill(target.email);
  await expect(page.getByText(target.name)).toBeVisible();
  await expect(page.getByText(seedUsers[1].name)).toBeHidden();
});

test('role change updates member role', async ({ page, user }) => {
  const { targetTenant, seedUsers } = await setupAdminWithTargetTenant(page, user);

  await goToMembershipsTab(page, targetTenant._id!);

  // Find the row showing the second seed user's email, then click its
  // edit (pencil) button. The row structure is a bordered div containing
  // name + email paragraphs and action buttons. We scope to the paragraph
  // text to avoid matching parent containers.
  const memberEmail = page.getByText(seedUsers[1].email);
  const memberRow = page.locator('div.border').filter({ has: memberEmail });
  await memberRow.getByRole('button').click();

  // Change role to admin via the select
  await memberRow.getByRole('combobox').selectOption('admin');

  // Verify the role updated and edit mode closed
  await expect(memberRow.getByText('admin')).toBeVisible();
});

test('archive removes member from active list and shows archived section', async ({
  page,
  user,
}) => {
  const { targetTenant, seedUsers } = await setupAdminWithTargetTenant(page, user);

  await goToMembershipsTab(page, targetTenant._id!);

  const target = seedUsers[1];

  // Enter edit mode for the member
  const memberEmail = page.getByText(target.email);
  const memberRow = page.locator('div.border').filter({ has: memberEmail });
  await memberRow.getByRole('button').click();

  // Click Archive
  await page.getByRole('button', { name: 'Archive' }).click();

  // Verify member removed from active list
  await expect(page.getByText(`Members (${seedUsers.length - 1})`)).toBeVisible();

  // Verify archived section appears
  await expect(page.getByText('Archived (1)')).toBeVisible();
});

test('add-member form opens and closes via collapsible trigger', async ({ page, user }) => {
  const { targetTenant } = await setupAdminWithTargetTenant(page, user, 1);

  await goToMembershipsTab(page, targetTenant._id!);

  const trigger = page.getByRole('button', { name: 'Add member' });

  // Open
  await trigger.click();
  await expect(page.getByLabel('User')).toBeVisible();
  await expect(page.getByLabel('Role')).toBeVisible();

  // Close
  await trigger.click();
  await expect(page.getByLabel('User')).toBeHidden();
});

test('candidates dropdown populates with users not in tenant', async ({ page, user }) => {
  const { targetTenant, seedUsers } = await setupAdminWithTargetTenant(page, user, 1);

  // Create a user with a membership in another tenant (not the target).
  // listUsersNotInTenant only discovers users who have at least one
  // membership row, so a membershipless user would not appear.
  const candidateId = randomBytes(6).toString('hex');
  const candidate = await createUser({
    email: `candidate-${candidateId}@test.local`,
    password: `pw-${candidateId}`,
    name: `Candidate ${candidateId}`,
  });
  const otherTenant = await createTenant({ name: `Other ${candidateId}`, type: 'contractor' });
  await createMembership({
    userId: candidate.userId!,
    tenantId: otherTenant._id!,
    role: 'member',
  });

  await goToMembershipsTab(page, targetTenant._id!);

  await page.getByRole('button', { name: 'Add member' }).click();

  const userSelect = page.getByLabel('User');
  await expect(userSelect).toBeVisible();

  // Wait for the candidates query to populate the dropdown
  await expect(userSelect.locator('option', { hasText: candidate.name })).toBeAttached();

  // Existing member should NOT appear as a candidate
  await expect(userSelect.locator('option', { hasText: seedUsers[0].name })).not.toBeAttached();
});

test('adding a member works and collapses the form', async ({ page, user }) => {
  const { targetTenant } = await setupAdminWithTargetTenant(page, user, 1);

  // Create a candidate with a membership in another tenant
  const candidateId = randomBytes(6).toString('hex');
  const candidate = await createUser({
    email: `add-${candidateId}@test.local`,
    password: `pw-${candidateId}`,
    name: `Add ${candidateId}`,
  });
  const otherTenant = await createTenant({ name: `Other ${candidateId}`, type: 'contractor' });
  await createMembership({
    userId: candidate.userId!,
    tenantId: otherTenant._id!,
    role: 'member',
  });

  await goToMembershipsTab(page, targetTenant._id!);

  // Verify initial count
  await expect(page.getByText('Members (1)')).toBeVisible();

  // Open form and add the user
  await page.getByRole('button', { name: 'Add member' }).click();

  const userSelect = page.getByLabel('User');
  // Wait for the candidates query to load
  await expect(userSelect.locator('option', { hasText: candidate.name })).toBeAttached();
  await userSelect.selectOption({ label: `${candidate.name} (${candidate.email})` });

  await page.getByRole('button', { name: 'Add', exact: true }).click();

  // Verify member appears in list with incremented count
  await expect(page.getByText('Members (2)')).toBeVisible();
  await expect(page.getByText(candidate.name)).toBeVisible();

  // Verify form collapsed (User select should be hidden)
  await expect(page.getByLabel('User')).toBeHidden();
});

test('add button is disabled without user selection', async ({ page, user }) => {
  const { targetTenant } = await setupAdminWithTargetTenant(page, user, 1);

  await goToMembershipsTab(page, targetTenant._id!);

  await page.getByRole('button', { name: 'Add member' }).click();

  const addButton = page.getByRole('button', { name: 'Add', exact: true });
  await expect(addButton).toBeDisabled();
});
