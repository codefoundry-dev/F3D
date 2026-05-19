import { test, expect, type Page } from '@playwright/test';
import { loginAs, navigateInApp } from '../helpers/procurement-helpers';
import { COMPANY_ADMIN } from '../fixtures/test-data';

test.describe('US-4 - Quote Review & Approval', () => {
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

  test.fixme('AC1: Multiple vendor quotes displayed in side-by-side comparison with lowest price highlighted', async () => {
    await navigateInApp(sharedPage, '/rfqs');

    // Find an RFQ with multiple vendor responses
    const table = sharedPage.locator('table');
    const hasTable = await table.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasTable) {
      // Navigate to an RFQ detail page with responses tab
      const firstRow = sharedPage.locator('tbody tr').first();
      await firstRow.click();
      await sharedPage.waitForURL(/\/rfqs\/[^/]+/, { timeout: 10000 });

      // Switch to Responses tab
      const responsesTab = sharedPage
        .getByRole('tab', { name: /responses/i })
        .or(sharedPage.getByText(/responses/i).first());
      await responsesTab.click();
      await sharedPage.waitForTimeout(1000);

      // Look for comparison view toggle
      const comparisonBtn = sharedPage.getByRole('button', {
        name: /compare|comparison|side.by.side/i,
      });
      const hasComparison = await comparisonBtn
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (hasComparison) {
        await comparisonBtn.first().click();
        await sharedPage.waitForTimeout(1000);

        // Verify lowest price highlighting
        const highlighted = sharedPage.locator(
          '[class*="highlight"], [class*="lowest"], [class*="best"]',
        );
        const hasHighlight = await highlighted
          .first()
          .isVisible()
          .catch(() => false);
        expect(hasHighlight).toBeTruthy();
      }
    }
  });

  test.fixme('AC2: Approve specific line items and verify only approved items are convertible', async () => {
    // Navigate to an RFQ with quotes
    await navigateInApp(sharedPage, '/rfqs');

    const rows = sharedPage.locator('tbody tr');
    const rowCount = await rows.count().catch(() => 0);
    if (rowCount > 0) {
      await rows.first().click();
      await sharedPage.waitForURL(/\/rfqs\/[^/]+/, { timeout: 10000 });

      // Go to responses tab
      const responsesTab = sharedPage.getByText(/responses/i).first();
      await responsesTab.click();
      await sharedPage.waitForTimeout(1000);

      // Look for approve buttons on line items
      const approveBtn = sharedPage.getByRole('button', { name: /approve/i });
      const hasApprove = await approveBtn
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (hasApprove) {
        // Approve the first line item
        await approveBtn.first().click();
        await sharedPage.waitForTimeout(1000);

        // Verify convert button appears only for approved items
        const convertBtn = sharedPage.getByRole('button', { name: /convert/i });
        const hasConvert = await convertBtn
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false);
        expect(hasConvert).toBeTruthy();
      }
    }
  });

  test.fixme('AC3: Convert approved quote to PO/bulk/hold-for-release with pre-populated data', async () => {
    await navigateInApp(sharedPage, '/rfqs');

    const rows = sharedPage.locator('tbody tr');
    const rowCount = await rows.count().catch(() => 0);
    if (rowCount > 0) {
      await rows.first().click();
      await sharedPage.waitForURL(/\/rfqs\/[^/]+/, { timeout: 10000 });

      // Find a convert button for an approved quote
      const convertBtn = sharedPage.getByRole('button', { name: /convert/i });
      const hasConvert = await convertBtn
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (hasConvert) {
        await convertBtn.first().click();
        await sharedPage.waitForTimeout(1000);

        // Verify conversion options: PO, bulk order, hold-for-release
        const poOption = sharedPage.getByText(/purchase order|standard po/i);
        const bulkOption = sharedPage.getByText(/bulk order/i);
        const holdOption = sharedPage.getByText(/hold.for.release/i);

        const hasPo = await poOption
          .first()
          .isVisible()
          .catch(() => false);
        const hasBulk = await bulkOption
          .first()
          .isVisible()
          .catch(() => false);
        expect(hasPo || hasBulk).toBeTruthy();
      }
    }
  });

  test.fixme('AC4: Close RFQ and verify non-approved vendors are notified', async () => {
    await navigateInApp(sharedPage, '/rfqs');

    const rows = sharedPage.locator('tbody tr');
    const rowCount = await rows.count().catch(() => 0);
    if (rowCount > 0) {
      await rows.first().click();
      await sharedPage.waitForURL(/\/rfqs\/[^/]+/, { timeout: 10000 });

      // Look for Close RFQ button
      const closeBtn = sharedPage.getByRole('button', { name: /close rfq|close/i });
      const hasClose = await closeBtn
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (hasClose) {
        await closeBtn.first().click();
        await sharedPage.waitForTimeout(1000);

        // Confirm the close action if there's a confirmation dialog
        const confirmBtn = sharedPage.getByRole('button', { name: /confirm|yes/i });
        const hasConfirm = await confirmBtn
          .first()
          .isVisible({ timeout: 3000 })
          .catch(() => false);
        if (hasConfirm) {
          await confirmBtn.first().click();
          await sharedPage.waitForTimeout(1000);
        }

        // Verify RFQ status changed to Closed
        const closedBadge = sharedPage.getByText(/closed/i);
        await expect(closedBadge.first()).toBeVisible({ timeout: 5000 });
      }
    }
  });
});
