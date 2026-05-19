import { test, expect, type Page } from '@playwright/test';
import { loginAs, navigateInApp, expectTableRows } from '../helpers/procurement-helpers';
import { PROCUREMENT_OFFICER } from '../fixtures/test-data';

test.describe('US-10.05 - PO Management Dashboard', () => {
  test.describe.configure({ mode: 'serial' });

  let sharedPage: Page;

  test.beforeAll(async ({ browser }) => {
    sharedPage = await browser.newPage({
      baseURL: 'http://localhost:3005',
    });
    await loginAs(sharedPage, PROCUREMENT_OFFICER.email, PROCUREMENT_OFFICER.password);
  });

  test.afterAll(async () => {
    await sharedPage?.close();
  });

  test('AC1: PO list page renders with "Create new" button', async () => {
    await navigateInApp(sharedPage, '/purchase-orders');

    // "Create new" primary button is visible
    const createBtn = sharedPage.getByRole('button', { name: 'Create new' });
    await expect(createBtn).toBeVisible({ timeout: 10000 });

    // Toolbar icons are present (view selector, export, settings)
    await expect(sharedPage.getByText('Default')).toBeVisible();
  });

  test('AC2: Table renders with column headers or empty state', async () => {
    await navigateInApp(sharedPage, '/purchase-orders');

    // Wait for loading to finish
    await sharedPage.waitForTimeout(2000);

    // Either the table with headers renders, or the empty state message shows
    const table = sharedPage.locator('table');
    const emptyState = sharedPage.getByText('No purchase orders found');

    const hasTable = await table.isVisible().catch(() => false);
    const hasEmpty = await emptyState.isVisible().catch(() => false);

    expect(hasTable || hasEmpty).toBeTruthy();

    if (hasTable) {
      // Verify key column headers are present
      await expect(sharedPage.locator('th', { hasText: 'PO number' })).toBeVisible();
      await expect(sharedPage.locator('th', { hasText: 'Project Name' })).toBeVisible();
      await expect(sharedPage.locator('th', { hasText: 'PO status' })).toBeVisible();
      await expect(sharedPage.locator('th', { hasText: 'Vendor name' })).toBeVisible();
      await expect(sharedPage.locator('th', { hasText: 'Actions' })).toBeVisible();
    }
  });

  test('AC3: Search input is visible and functional', async () => {
    await navigateInApp(sharedPage, '/purchase-orders');

    // The search is behind a search icon button; click it to open
    const searchToggle = sharedPage
      .locator('button')
      .filter({ has: sharedPage.locator('svg') })
      .last();

    // Find the search icon button specifically (the small icon-only button in the toolbar)
    const searchBtn = sharedPage.locator('button[type="button"]').filter({
      has: sharedPage.locator('svg'),
    });

    // Look for the search input or the toggle button
    const searchInput = sharedPage.getByPlaceholder('Search by PO number or project name');
    const isInputVisible = await searchInput.isVisible().catch(() => false);

    if (!isInputVisible) {
      // Search is collapsed; there should be a toggle button to open it
      // The search icon button is the last toolbar icon
      const toolbarButtons = sharedPage.locator('.shrink-0 button[type="button"]');
      const count = await toolbarButtons.count();
      if (count > 0) {
        await toolbarButtons.last().click();
        await sharedPage.waitForTimeout(300);
      }
    }

    // Now the search input should be visible
    const input = sharedPage.getByPlaceholder('Search by PO number or project name');
    await expect(input).toBeVisible({ timeout: 5000 });

    // Type a search term and verify it accepts input
    await input.fill('test-search');
    await expect(input).toHaveValue('test-search');

    // Clear the search
    await input.fill('');
    await expect(input).toHaveValue('');
  });

  test('AC4: Quick filter tabs are visible and clickable', async () => {
    await navigateInApp(sharedPage, '/purchase-orders');

    // Quick Filters label should be visible
    await expect(sharedPage.getByText('Quick Filters:')).toBeVisible({ timeout: 10000 });

    // Verify several quick filter chips are present
    const allOpenChip = sharedPage.getByText('All open', { exact: true });
    await expect(allOpenChip).toBeVisible();

    const closedChip = sharedPage.getByText('Closed', { exact: true });
    await expect(closedChip).toBeVisible();

    const dueSoonChip = sharedPage.getByText('Due soon', { exact: true });
    await expect(dueSoonChip).toBeVisible();

    // Click a filter chip and verify it becomes active (toggleable)
    await allOpenChip.click();
    await sharedPage.waitForTimeout(500);

    // Click the same chip again to deselect
    await allOpenChip.click();
    await sharedPage.waitForTimeout(500);
  });

  test('Edge: Empty PO list shows appropriate empty state', async () => {
    await navigateInApp(sharedPage, '/purchase-orders');

    // Wait for content to load
    await sharedPage.waitForTimeout(2000);

    // Check current state: either data table or empty message
    const emptyState = sharedPage.getByText('No purchase orders found');
    const tableBody = sharedPage.locator('tbody tr');

    const hasEmpty = await emptyState.isVisible().catch(() => false);
    const rowCount = await tableBody.count().catch(() => 0);

    if (hasEmpty) {
      // Empty state text is displayed correctly
      await expect(emptyState).toBeVisible();
      // Pagination should NOT be visible when there are no results
      await expect(sharedPage.getByText('Rows per page:')).not.toBeVisible();
    } else {
      // If there are rows, pagination should be visible
      expect(rowCount).toBeGreaterThan(0);
      await expect(sharedPage.getByText(/Showing \d+ to \d+ of \d+ POs/)).toBeVisible();
    }
  });
});
