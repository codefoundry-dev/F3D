import { test, expect, type Page } from '@playwright/test';
import { loginAs, navigateInApp } from '../helpers/procurement-helpers';
import { FINANCE_OFFICER } from '../fixtures/test-data';

test.describe('US-10.03 - Finance Officer Dashboard', () => {
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

  test('AC1: Upload invoice button visible and navigates to /invoices', async () => {
    await navigateInApp(sharedPage, '/');

    const uploadBtn = sharedPage.getByRole('button', { name: /upload invoice/i });
    await expect(uploadBtn).toBeVisible({ timeout: 10000 });

    await uploadBtn.click();
    await sharedPage.waitForTimeout(1000);

    // Should navigate to the invoices route
    expect(sharedPage.url()).toContain('/invoices');

    // Navigate back for remaining tests
    await navigateInApp(sharedPage, '/');
  });

  test('AC2: KPI cards render (Total Pending Amount, Due This Week, Disputed)', async () => {
    await navigateInApp(sharedPage, '/');

    // Total Pending Invoice Amount card
    await expect(sharedPage.getByText('Total Pending Invoice Amount')).toBeVisible({
      timeout: 10000,
    });

    // Invoices Due This Week card
    await expect(sharedPage.getByText('Invoices Due This Week')).toBeVisible();

    // Disputed Invoices card
    await expect(sharedPage.getByText('Disputed Invoices')).toBeVisible();
  });

  test('AC3: Invoices pending approval section visible with heading', async () => {
    await navigateInApp(sharedPage, '/');

    await expect(sharedPage.getByText('Invoices pending approval')).toBeVisible({ timeout: 10000 });
  });

  test('AC4: Disputed invoices section visible with heading', async () => {
    await navigateInApp(sharedPage, '/');

    await expect(sharedPage.getByText('Disputed Invoices').first()).toBeVisible({ timeout: 10000 });
  });

  test('Edge: Empty dashboard shows "No invoices pending" / "No disputed invoices" messages', async () => {
    await navigateInApp(sharedPage, '/');

    // Wait for loading to finish (skeletons disappear)
    await sharedPage.waitForTimeout(3000);

    // At least one of these empty states should be present if there is no data,
    // or the sections should contain invoice cards. Either way the sections must render.
    const pendingSection = sharedPage.getByText('Invoices pending approval');
    await expect(pendingSection).toBeVisible({ timeout: 10000 });

    const disputedSection = sharedPage.getByText('Disputed Invoices').first();
    await expect(disputedSection).toBeVisible();

    // Check for empty states — these appear when no invoices exist
    const noPending = sharedPage.getByText('No invoices pending');
    const noDisputed = sharedPage.getByText('No disputed invoices');

    // At least verify the empty-state text elements exist in the DOM
    // (they may or may not be visible depending on seeded data)
    const hasPendingEmpty = await noPending.isVisible().catch(() => false);
    const hasDisputedEmpty = await noDisputed.isVisible().catch(() => false);

    // If there are no invoice cards, empty states must be shown
    const rejectButtons = await sharedPage.getByRole('button', { name: /reject/i }).count();
    if (rejectButtons === 0) {
      expect(hasPendingEmpty).toBe(true);
    }

    const disputedCards = await sharedPage.locator('[data-testid="invoice-card"]').count();
    if (disputedCards === 0 && rejectButtons === 0) {
      // With no data at all, at least one empty state should show
      expect(hasPendingEmpty || hasDisputedEmpty).toBe(true);
    }
  });
});
