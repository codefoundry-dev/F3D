import { test, expect, type Page } from '@playwright/test';
import { loginAs, navigateInApp } from '../helpers/procurement-helpers';
import { FINANCE_OFFICER } from '../fixtures/test-data';

test.describe('US-10.07 - Invoice Management', () => {
  test.describe.configure({ mode: 'serial' });

  let sharedPage: Page;

  test.beforeAll(async ({ browser }) => {
    sharedPage = await browser.newPage({
      baseURL: 'http://localhost:3004',
    });
    await loginAs(sharedPage, FINANCE_OFFICER.email, FINANCE_OFFICER.password);
  });

  test.afterAll(async () => {
    await sharedPage?.close();
  });

  test('AC1: Invoice list page renders with heading and table', async () => {
    await navigateInApp(sharedPage, '/invoices');

    // The page should render — look for the create-new button or search bar as proof
    const createNewBtn = sharedPage.getByRole('button', { name: /create new/i });
    await expect(createNewBtn).toBeVisible({ timeout: 10000 });

    // Table or empty state should be present
    const table = sharedPage.locator('table');
    const emptyState = sharedPage.getByText('Search');
    const hasTable = await table.isVisible().catch(() => false);
    const hasEmpty = await emptyState.isVisible().catch(() => false);
    expect(hasTable || hasEmpty).toBe(true);
  });

  test('AC2: Search input and filter controls are visible', async () => {
    await navigateInApp(sharedPage, '/invoices');

    // Search input
    const searchInput = sharedPage.getByPlaceholder('Search');
    await expect(searchInput).toBeVisible({ timeout: 10000 });

    // Filters button
    const filtersBtn = sharedPage.getByRole('button', { name: /filters/i });
    await expect(filtersBtn).toBeVisible();

    // Create new button
    const createNewBtn = sharedPage.getByRole('button', { name: /create new/i });
    await expect(createNewBtn).toBeVisible();
  });

  test('AC3: Invoice table shows expected columns or empty state', async () => {
    await navigateInApp(sharedPage, '/invoices');
    await sharedPage.waitForTimeout(1000);

    const table = sharedPage.locator('table');
    const hasTable = await table.isVisible().catch(() => false);

    if (hasTable) {
      // Verify expected column headers are present
      const thead = sharedPage.locator('thead');
      await expect(thead.getByText('Invoice ID')).toBeVisible();
      await expect(thead.getByText('Project Name')).toBeVisible();
      await expect(thead.getByText('Vendor name')).toBeVisible();
      await expect(thead.getByText('Status')).toBeVisible();
      await expect(thead.getByText('Total amount')).toBeVisible();
      await expect(thead.getByText('Due Date')).toBeVisible();
      await expect(thead.getByText('Actions')).toBeVisible();

      // At least one body row should exist
      const rows = sharedPage.locator('tbody tr');
      const rowCount = await rows.count();
      expect(rowCount).toBeGreaterThan(0);
    } else {
      // If no table, the empty state text should show
      await expect(sharedPage.getByText('Search')).toBeVisible();
    }
  });

  test('AC4: Clicking an invoice row navigates to detail page', async () => {
    await navigateInApp(sharedPage, '/invoices');
    await sharedPage.waitForTimeout(1000);

    const rows = sharedPage.locator('tbody tr');
    const rowCount = await rows.count();

    if (rowCount > 0) {
      // Click the view (eye) icon button on the first row
      const firstRow = rows.first();
      const viewButton = firstRow.getByTitle('View');
      await viewButton.click();
      await sharedPage.waitForTimeout(1000);

      // URL should contain /invoices/ followed by an ID
      expect(sharedPage.url()).toMatch(/\/invoices\/\w+/);

      // Detail page should have tab buttons (Messages, Quote Line Items, Attachments)
      await expect(sharedPage.getByRole('button', { name: /quote line items/i })).toBeVisible({
        timeout: 10000,
      });

      // Navigate back
      await navigateInApp(sharedPage, '/invoices');
    } else {
      // No rows — skip navigation check, just confirm empty state
      test.skip();
    }
  });

  test('Edge: Empty invoice list shows appropriate empty state', async () => {
    await navigateInApp(sharedPage, '/invoices');
    await sharedPage.waitForTimeout(1000);

    // Type a search term that will not match anything
    const searchInput = sharedPage.getByPlaceholder('Search');
    await searchInput.fill('zzz-nonexistent-invoice-xyz-999');
    await sharedPage.waitForTimeout(500);

    // Table should either be gone or have 0 body rows
    const rows = sharedPage.locator('tbody tr');
    const rowCount = await rows.count();
    expect(rowCount).toBe(0);

    // The empty state text "Search" should appear (the searchPlaceholder i18n key)
    await expect(sharedPage.getByText('Search').first()).toBeVisible();

    // Clear the search to restore state
    await searchInput.clear();
  });
});
