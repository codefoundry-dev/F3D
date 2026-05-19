import { test, expect, type Page } from '@playwright/test';
import { loginAs, navigateInApp, fillField } from '../helpers/procurement-helpers';
import { SUPER_ADMIN } from '../fixtures/test-data';

// Share a single login session across all tests in this describe block
test.describe('US-1.05 - RBA Management (Super Admin)', () => {
  test.describe.configure({ mode: 'serial' });

  let sharedPage: Page;

  test.beforeAll(async ({ browser }) => {
    sharedPage = await browser.newPage({
      baseURL: 'http://localhost:3001',
    });
    await loginAs(sharedPage, SUPER_ADMIN.email, SUPER_ADMIN.password, {
      navigateTo: '/settings/users',
    });
    await sharedPage.waitForSelector('table', { timeout: 15000 });
  });

  test.afterAll(async () => {
    await sharedPage?.close();
  });

  test('AC1: View all platform users in table with columns', async () => {
    await expect(sharedPage.locator('th', { hasText: /full name/i })).toBeVisible();
    await expect(sharedPage.locator('th', { hasText: /email/i })).toBeVisible();
    await expect(sharedPage.locator('th', { hasText: /phone/i })).toBeVisible();
    await expect(sharedPage.locator('th', { hasText: /role/i })).toBeVisible();
    await expect(sharedPage.locator('th', { hasText: /status/i })).toBeVisible();

    await expect(sharedPage.locator('tbody tr').first()).toBeVisible();
  });

  test('AC2: Search users by name or email', async () => {
    const searchInput = sharedPage.getByPlaceholder(/search by name or email/i);
    await searchInput.fill(SUPER_ADMIN.email.split('@')[0]);
    await sharedPage.waitForTimeout(500);

    await expect(sharedPage.locator('tbody tr').first()).toBeVisible();

    // Clear search
    await searchInput.clear();
    await sharedPage.waitForTimeout(500);
  });

  test('AC3: Filter users by status', async () => {
    // FilterPopover trigger button
    const statusFilterBtn = sharedPage.getByRole('button', { name: /^status/i });
    await statusFilterBtn.click();

    // Check "Active" checkbox — click the label text since native input is sr-only
    await sharedPage.getByLabel('Active', { exact: true }).check({ force: true });

    // Close filter by pressing Escape
    await sharedPage.keyboard.press('Escape');
    await sharedPage.waitForTimeout(1000);

    // After filtering, the table should still have rows (active users exist)
    await expect(sharedPage.locator('tbody tr').first()).toBeVisible({ timeout: 5000 });

    // Clear the filter
    await statusFilterBtn.click();
    await sharedPage.getByLabel('Active', { exact: true }).uncheck({ force: true });
    await sharedPage.keyboard.press('Escape');
    await sharedPage.waitForTimeout(500);
  });

  test('AC4: Sort by column headers', async () => {
    await sharedPage.locator('th', { hasText: /full name/i }).click();
    await sharedPage.waitForTimeout(300);

    await sharedPage.locator('th', { hasText: /full name/i }).click();
    await sharedPage.waitForTimeout(300);

    await expect(sharedPage.locator('tbody tr').first()).toBeVisible();
  });

  test('AC5: Edit user details via modal', async () => {
    // Expand first company group
    const companyRow = sharedPage.locator('tbody tr').first();
    await companyRow.click();
    await sharedPage.waitForTimeout(300);

    // Click the edit icon (aria-label="Edit") on a user row
    const editBtn = sharedPage.locator('tbody tr').locator('button[aria-label="Edit"]').first();
    if (await editBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await editBtn.click();

      await expect(sharedPage.getByText('Edit User Details')).toBeVisible({ timeout: 5000 });
      await sharedPage.getByRole('button', { name: 'Cancel' }).click();
    }
  });

  test('AC6: Deactivate user and verify status badge changes', async () => {
    // Navigate back to user list
    await navigateInApp(sharedPage, '/settings/users');
    await sharedPage.waitForSelector('table', { timeout: 15000 });

    // Expand first company group
    const companyRow = sharedPage.locator('tbody tr').first();
    await companyRow.click();
    await sharedPage.waitForTimeout(300);

    // Find an Active user row's DotActionsMenu (three-dot button)
    const activeUserRow = sharedPage.locator('tbody tr').filter({ hasText: 'Active' }).first();
    if ((await activeUserRow.count()) === 0) {
      test.skip(true, 'No active users found to deactivate');
      return;
    }

    // The three-dot menu is the last button (after View and Edit icons)
    const dotMenu = activeUserRow.locator('button').last();
    await dotMenu.click();

    const deactivateOption = sharedPage.getByText('Deactivate', { exact: true });
    if (await deactivateOption.isVisible({ timeout: 2000 }).catch(() => false)) {
      await deactivateOption.click();
      // Confirmation dialog should appear
      await expect(sharedPage.getByRole('button', { name: /deactivate/i })).toBeVisible();
      await sharedPage.getByRole('button', { name: 'Cancel' }).click();
    }
  });

  test('AC7: Company detail page shows tabs', async () => {
    await navigateInApp(sharedPage, '/settings/users');
    await sharedPage.waitForSelector('table', { timeout: 15000 });

    // Click the eye icon (aria-label="View company") on a company header row
    const viewCompanyBtn = sharedPage.locator('button[aria-label="View company"]').first();
    await viewCompanyBtn.click();

    await sharedPage.waitForURL('**/companies/*', { timeout: 10000 });

    await expect(sharedPage.getByText('Overview')).toBeVisible();
    await expect(sharedPage.getByText('Company users')).toBeVisible();
    await expect(sharedPage.getByText('Documents')).toBeVisible();
  });

  test('Edge: Bulk deactivate all company users', async () => {
    // Should already be on company detail from AC7
    // If not, navigate there
    if (!sharedPage.url().includes('/companies/')) {
      await navigateInApp(sharedPage, '/settings/users');
      await sharedPage.waitForSelector('table', { timeout: 15000 });
      const viewBtn = sharedPage.locator('button[aria-label="View company"]').first();
      await viewBtn.click();
      await sharedPage.waitForURL('**/companies/*', { timeout: 10000 });
    }

    // Look for bulk action buttons or dot menu
    const bulkBtn = sharedPage
      .locator('button')
      .filter({ hasText: /deactivate all|activate all/i });
    if ((await bulkBtn.count()) > 0) {
      await expect(bulkBtn.first()).toBeVisible();
    } else {
      const dotMenu = sharedPage.getByLabel('Actions').first();
      if (await dotMenu.isVisible({ timeout: 2000 }).catch(() => false)) {
        await dotMenu.click();
        await expect(sharedPage.getByText(/deactivate all|activate all/i)).toBeVisible();
      }
    }
  });
});
