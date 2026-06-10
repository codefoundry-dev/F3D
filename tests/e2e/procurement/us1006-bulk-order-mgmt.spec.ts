import { test, expect, type Page } from '@playwright/test';
import { loginAs, navigateInApp, expectTableRows } from '../helpers/procurement-helpers';
import { COMPANY_ADMIN } from '../fixtures/test-data';

test.describe('US-10.06 - Bulk Order Management', () => {
  test.describe.configure({ mode: 'serial' });

  let sharedPage: Page;

  test.beforeAll(async ({ browser }) => {
    sharedPage = await browser.newPage({
      baseURL: 'http://localhost:3002',
    });
    await loginAs(sharedPage, COMPANY_ADMIN.email, COMPANY_ADMIN.password);
  });

  test.afterAll(async () => {
    await sharedPage?.close();
  });

  test('AC1: Bulk orders list page renders with heading', async () => {
    await navigateInApp(sharedPage, '/bulk-orders');

    // The page should render with the "Create new" button
    const createBtn = sharedPage.getByRole('button', { name: '+ Create new' });
    await expect(createBtn).toBeVisible({ timeout: 10000 });

    // Search input should be present in toolbar
    const searchInput = sharedPage.getByPlaceholder('Search');
    await expect(searchInput).toBeVisible();
  });

  test('AC2: Table renders with expected columns or shows empty state', async () => {
    await navigateInApp(sharedPage, '/bulk-orders');

    // Wait for loading to complete
    await sharedPage.waitForTimeout(2000);

    const table = sharedPage.locator('table');
    const emptyState = sharedPage.getByText('No bulk orders found');

    const hasTable = await table.isVisible().catch(() => false);
    const hasEmpty = await emptyState.isVisible().catch(() => false);

    expect(hasTable || hasEmpty).toBeTruthy();

    if (hasTable) {
      // Verify key column headers
      await expect(sharedPage.locator('th', { hasText: 'Bulk Order ID' })).toBeVisible();
      await expect(sharedPage.locator('th', { hasText: 'Project Name' })).toBeVisible();
      await expect(sharedPage.locator('th', { hasText: 'Vendor name' })).toBeVisible();
      await expect(sharedPage.locator('th', { hasText: 'Status' })).toBeVisible();
      await expect(sharedPage.locator('th', { hasText: 'Line items' })).toBeVisible();
      await expect(sharedPage.locator('th', { hasText: 'Actions' })).toBeVisible();
    }
  });

  test('AC3: Search input is visible', async () => {
    await navigateInApp(sharedPage, '/bulk-orders');

    // Search input is always visible (not behind a toggle like POs)
    const searchInput = sharedPage.getByPlaceholder('Search');
    await expect(searchInput).toBeVisible({ timeout: 10000 });

    // Verify it accepts input
    await searchInput.fill('test-query');
    await expect(searchInput).toHaveValue('test-query');
    await searchInput.fill('');

    // Filter dropdowns should also be present
    await expect(sharedPage.getByText('All projects')).toBeVisible();
    await expect(sharedPage.getByText('All vendors')).toBeVisible();
  });

  test('AC4: Clicking a bulk order row navigates to detail page (if data exists)', async () => {
    await navigateInApp(sharedPage, '/bulk-orders');
    await sharedPage.waitForTimeout(2000);

    const rows = sharedPage.locator('tbody tr');
    const rowCount = await rows.count().catch(() => 0);

    if (rowCount > 0) {
      // Click the first row (not the actions cell)
      const firstRowFirstCell = rows.first().locator('td').first();
      await firstRowFirstCell.click();

      // Should navigate to the detail page
      await sharedPage.waitForTimeout(1000);
      await expect(sharedPage.url()).toContain('/bulk-orders/');

      // Navigate back to the list for subsequent tests
      await navigateInApp(sharedPage, '/bulk-orders');
    } else {
      // No data - just verify empty state
      await expect(sharedPage.getByText('No bulk orders found')).toBeVisible();
    }
  });

  test('AC5: Detail page shows line items table (if navigated)', async () => {
    await navigateInApp(sharedPage, '/bulk-orders');
    await sharedPage.waitForTimeout(2000);

    const rows = sharedPage.locator('tbody tr');
    const rowCount = await rows.count().catch(() => 0);

    if (rowCount > 0) {
      // Navigate to first bulk order detail
      const firstRowFirstCell = rows.first().locator('td').first();
      await firstRowFirstCell.click();
      await sharedPage.waitForTimeout(1500);

      // Detail page should show Bulk Details section
      await expect(sharedPage.getByText('Bulk Details')).toBeVisible({ timeout: 10000 });

      // Line Items table should be visible
      await expect(sharedPage.getByText('Line Items', { exact: true })).toBeVisible();

      // Should have line item column headers
      const lineItemTable = sharedPage.locator('table');
      await expect(lineItemTable).toBeVisible();

      // Verify key line item columns
      await expect(sharedPage.locator('th', { hasText: 'Line Item ID' })).toBeVisible();
      await expect(sharedPage.locator('th', { hasText: 'Description' })).toBeVisible();
      await expect(sharedPage.locator('th', { hasText: 'Qty' })).toBeVisible();

      // "+ Create drawdown" button should be visible
      await expect(sharedPage.getByRole('button', { name: '+ Create drawdown' })).toBeVisible();

      // Navigate back
      await navigateInApp(sharedPage, '/bulk-orders');
    } else {
      // No data to navigate to - skip gracefully
      test.skip();
    }
  });

  test('AC6: Status badges display correctly in table', async () => {
    await navigateInApp(sharedPage, '/bulk-orders');
    await sharedPage.waitForTimeout(2000);

    const rows = sharedPage.locator('tbody tr');
    const rowCount = await rows.count().catch(() => 0);

    if (rowCount > 0) {
      // Each row should have a status badge in the Status column
      // Status column is the 5th column (index 4)
      const firstRowStatusCell = rows.first().locator('td').nth(4);
      const badge = firstRowStatusCell.locator('span');
      await expect(badge).toBeVisible();

      // Badge text should be one of the known statuses
      const badgeText = await badge.textContent();
      const validStatuses = ['Active', 'Expired', 'Completed', 'Cancelled'];
      expect(validStatuses.some((s) => badgeText?.includes(s))).toBeTruthy();
    } else {
      // No data - verify empty state instead
      await expect(sharedPage.getByText('No bulk orders found')).toBeVisible();
    }
  });

  test('Edge: Empty bulk order list shows appropriate message', async () => {
    await navigateInApp(sharedPage, '/bulk-orders');
    await sharedPage.waitForTimeout(2000);

    const emptyState = sharedPage.getByText('No bulk orders found');
    const tableBody = sharedPage.locator('tbody tr');

    const hasEmpty = await emptyState.isVisible().catch(() => false);
    const rowCount = await tableBody.count().catch(() => 0);

    if (hasEmpty) {
      // Empty state message is displayed
      await expect(emptyState).toBeVisible();

      // Pagination should NOT be visible when there are no results
      await expect(sharedPage.getByText('Rows per page:')).not.toBeVisible();

      // But toolbar elements should still be present
      await expect(sharedPage.getByPlaceholder('Search')).toBeVisible();
      await expect(sharedPage.getByRole('button', { name: '+ Create new' })).toBeVisible();
    } else {
      // Data exists - pagination should be visible
      expect(rowCount).toBeGreaterThan(0);
      await expect(sharedPage.getByText(/Showing \d+ to \d+ of \d+ bulk orders/)).toBeVisible();
    }
  });
});
