import { test, expect, type Page } from '@playwright/test';
import { loginAs, navigateInApp } from '../helpers/procurement-helpers';
import { SUPER_ADMIN } from '../fixtures/test-data';

test.describe('US-12 - System Administration', () => {
  test.describe.configure({ mode: 'serial' });

  let sharedPage: Page;

  test.beforeAll(async ({ browser }) => {
    sharedPage = await browser.newPage({
      baseURL: 'http://localhost:3001',
    });
    await loginAs(sharedPage, SUPER_ADMIN.email, SUPER_ADMIN.password);
  });

  test.afterAll(async () => {
    await sharedPage?.close();
  });

  test('AC1: SA dashboard renders with KPI cards (Platform Status, Active Users, Total Companies, DB Performance)', async () => {
    await navigateInApp(sharedPage, '/');

    // Verify all 4 KPI cards are visible by their titles
    await expect(sharedPage.getByText('Overall Platform Status')).toBeVisible({ timeout: 15000 });

    await expect(sharedPage.getByText('Active Users')).toBeVisible({ timeout: 5000 });

    await expect(sharedPage.getByText('Total Companies')).toBeVisible({ timeout: 5000 });

    await expect(sharedPage.getByText('Database Performance')).toBeVisible({ timeout: 5000 });

    // Platform Status should show a value (either "All Systems Operational" or "Degraded")
    const statusOperational = sharedPage.getByText('All Systems Operational');
    const statusDegraded = sharedPage.getByText('Degraded');
    const hasOperational = await statusOperational.isVisible().catch(() => false);
    const hasDegraded = await statusDegraded.isVisible().catch(() => false);
    expect(hasOperational || hasDegraded).toBeTruthy();

    // Active Users card should display a numeric value (not just "...")
    // The value is rendered as a sibling of the title text inside KpiCard
    await expect(sharedPage.getByText(/^\d+$/).first()).toBeVisible({ timeout: 10000 });

    // DB Performance card should show a value with "ms"
    await expect(sharedPage.getByText(/\d+\s*ms/)).toBeVisible({ timeout: 5000 });
  });

  test('AC2: Quick action buttons visible and navigating correctly', async () => {
    await navigateInApp(sharedPage, '/');

    // Verify the three enabled quick action buttons are visible
    await expect(sharedPage.getByRole('button', { name: 'User Management' })).toBeVisible({
      timeout: 10000,
    });

    await expect(sharedPage.getByRole('button', { name: 'Company Management' })).toBeVisible({
      timeout: 5000,
    });

    await expect(sharedPage.getByRole('button', { name: 'Admin Panel' })).toBeVisible({
      timeout: 5000,
    });

    // Public Material Catalogue should be visible but disabled
    const catalogueBtn = sharedPage.getByRole('button', { name: 'Public Material Catalogue' });
    await expect(catalogueBtn).toBeVisible({ timeout: 5000 });
    await expect(catalogueBtn).toBeDisabled();

    // Click "User Management" → should navigate to users page
    await sharedPage.getByRole('button', { name: 'User Management' }).click();
    await sharedPage.waitForTimeout(1000);
    expect(sharedPage.url()).toContain('/users');
    await navigateInApp(sharedPage, '/');

    // Click "Admin Panel" → should navigate to admin-panel page
    await sharedPage.getByRole('button', { name: 'Admin Panel' }).click();
    await sharedPage.waitForTimeout(1000);
    expect(sharedPage.url()).toContain('/admin-panel');
    await navigateInApp(sharedPage, '/');
  });

  test('AC3: Platform State table, Recent Changes timeline, and Users by Role sections all render', async () => {
    await navigateInApp(sharedPage, '/');

    // Platform State table section
    await expect(sharedPage.getByText('Platform State')).toBeVisible({ timeout: 15000 });

    // Verify the table has column headers
    await expect(sharedPage.getByText('Component')).toBeVisible({ timeout: 5000 });

    await expect(sharedPage.getByText('Status', { exact: true })).toBeVisible({ timeout: 5000 });

    // Verify at least one table row exists (tbody tr) or the table loaded without error
    const tableRows = sharedPage.locator('table tbody tr');
    const rowCount = await tableRows.count();
    // Platform state table should have at least one row of component data
    expect(rowCount).toBeGreaterThanOrEqual(1);

    // Recent Changes timeline section
    const recentChangesHeading = sharedPage.getByText('Recent platform-level changes');
    await expect(recentChangesHeading).toBeVisible({ timeout: 5000 });

    // Either audit log entries or "No recent changes" message should be present
    const hasTimeline = await sharedPage
      .locator('.space-y-0 .flex.gap-4')
      .first()
      .isVisible()
      .catch(() => false);
    const hasNoChanges = await sharedPage
      .getByText('No recent changes')
      .isVisible()
      .catch(() => false);
    expect(hasTimeline || hasNoChanges).toBeTruthy();

    // Users by Role section
    await expect(sharedPage.getByText('Users by Role')).toBeVisible({ timeout: 5000 });

    // Should display at least one role row (e.g. "super admin" with a count)
    const roleRows = sharedPage.locator(
      'text=/super admin|company admin|procurement officer|vendor/i',
    );
    const roleCount = await roleRows.count();
    expect(roleCount).toBeGreaterThanOrEqual(1);
  });
});
