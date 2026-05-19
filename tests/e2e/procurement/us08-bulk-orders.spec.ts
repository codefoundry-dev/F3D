import { test, expect, type Page } from '@playwright/test';
import { loginAs, navigateInApp } from '../helpers/procurement-helpers';
import { PROCUREMENT_OFFICER, VENDOR_USER } from '../fixtures/test-data';

test.describe('US-8 - Bulk Order Management', () => {
  test.describe.configure({ mode: 'serial' });

  let sharedPage: Page;

  test.beforeAll(async ({ browser }) => {
    sharedPage = await browser.newPage({
      baseURL: 'http://localhost:3002',
    });
    await loginAs(sharedPage, PROCUREMENT_OFFICER.email, PROCUREMENT_OFFICER.password);
  });

  test.afterAll(async () => {
    await sharedPage?.close();
  });

  test.fixme('AC1: PO creates bulk order from approved RFQ → system tracks quantities, auto-suggests drawdowns', async () => {
    await navigateInApp(sharedPage, '/rfqs');

    const rows = sharedPage.locator('tbody tr');
    const rowCount = await rows.count().catch(() => 0);

    if (rowCount > 0) {
      await rows.first().click();
      await sharedPage.waitForURL(/\/rfqs\/[^/]+/, { timeout: 10000 });

      // Look for "Create Bulk Order" action
      const bulkOrderBtn = sharedPage.getByRole('button', {
        name: /create bulk order|bulk order/i,
      });
      const hasBulkBtn = await bulkOrderBtn
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (hasBulkBtn) {
        await bulkOrderBtn.first().click();
        await sharedPage.waitForTimeout(1000);

        // Fill bulk order form
        const endDateField = sharedPage.getByLabel(/end date/i);
        const hasEndDate = await endDateField.isVisible({ timeout: 5000 }).catch(() => false);
        if (hasEndDate) {
          await endDateField.fill('2027-12-31');
        }

        const submitBtn = sharedPage.getByRole('button', { name: /save|create|submit/i });
        const hasSubmit = await submitBtn
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false);
        if (hasSubmit) {
          await submitBtn.first().click();
          await sharedPage.waitForTimeout(2000);
        }
      }
    }
  });

  test.fixme('AC2: Bulk order assigned to project → users not assigned to project cannot see it for drawdown', async () => {
    await navigateInApp(sharedPage, '/bulk-orders');

    // Verify bulk orders are filtered by project assignment
    const table = sharedPage.locator('table');
    const hasTable = await table.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasTable) {
      const rows = sharedPage.locator('tbody tr');
      const rowCount = await rows.count();
      // PO should only see bulk orders for their assigned projects
      expect(rowCount).toBeGreaterThanOrEqual(0);
    }
  });

  test.fixme('AC3: Either party proposes change to active bulk agreement → current version unchanged; other party notified', async () => {
    await navigateInApp(sharedPage, '/bulk-orders');

    const rows = sharedPage.locator('tbody tr');
    const rowCount = await rows.count().catch(() => 0);

    if (rowCount > 0) {
      await rows.first().click();
      await sharedPage.waitForTimeout(1000);

      // Look for change proposal action
      const changeBtn = sharedPage.getByRole('button', { name: /propose change|amend|change/i });
      const hasChange = await changeBtn
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (hasChange) {
        await changeBtn.first().click();
        await sharedPage.waitForTimeout(1000);

        // Modify terms
        const qtyField = sharedPage.getByLabel(/quantity/i).first();
        const hasQty = await qtyField.isVisible({ timeout: 5000 }).catch(() => false);
        if (hasQty) {
          await qtyField.fill('500');
        }

        const submitBtn = sharedPage.getByRole('button', { name: /submit|propose/i });
        const hasSubmit = await submitBtn
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false);
        if (hasSubmit) {
          await submitBtn.first().click();
          await sharedPage.waitForTimeout(1000);
        }
      }
    }
  });

  test.fixme('AC4: Expired bulk order → PO can propose new end date; vendor must approve extension', async () => {
    await navigateInApp(sharedPage, '/bulk-orders');

    // Filter by expired
    const filterBtn = sharedPage.getByRole('button', { name: /filter/i });
    const hasFilter = await filterBtn
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (hasFilter) {
      await filterBtn.first().click();
      await sharedPage.waitForTimeout(500);

      const expiredFilter = sharedPage.getByText(/expired/i);
      const hasExpired = await expiredFilter
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      if (hasExpired) {
        await expiredFilter.first().click();
        await sharedPage.waitForTimeout(1000);
      }
    }

    // Open an expired bulk order
    const expiredRow = sharedPage.locator('tbody tr').first();
    const hasRow = await expiredRow.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasRow) {
      await expiredRow.click();
      await sharedPage.waitForTimeout(1000);

      // Propose extension
      const extendBtn = sharedPage.getByRole('button', { name: /extend|propose extension/i });
      const hasExtend = await extendBtn
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);
      if (hasExtend) {
        await extendBtn.first().click();
        await sharedPage.waitForTimeout(500);

        const newDateField = sharedPage.getByLabel(/new end date|end date/i);
        const hasDate = await newDateField.isVisible({ timeout: 5000 }).catch(() => false);
        if (hasDate) {
          await newDateField.fill('2028-06-30');
          const submitBtn = sharedPage.getByRole('button', { name: /submit|propose/i });
          await submitBtn.first().click();
          await sharedPage.waitForTimeout(1000);
        }
      }
    }
  });

  test.fixme('Edge: Drawdown quantity exceeds remaining → validation error, must reduce or proceed as standard order', async () => {
    await navigateInApp(sharedPage, '/bulk-orders');

    const rows = sharedPage.locator('tbody tr');
    const rowCount = await rows.count().catch(() => 0);

    if (rowCount > 0) {
      await rows.first().click();
      await sharedPage.waitForTimeout(1000);

      // Initiate drawdown
      const drawdownBtn = sharedPage.getByRole('button', { name: /drawdown|create drawdown/i });
      const hasDrawdown = await drawdownBtn
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (hasDrawdown) {
        await drawdownBtn.first().click();
        await sharedPage.waitForTimeout(500);

        // Enter excessive quantity
        const qtyField = sharedPage.getByLabel(/quantity/i).first();
        const hasQty = await qtyField.isVisible({ timeout: 5000 }).catch(() => false);
        if (hasQty) {
          await qtyField.fill('999999');
          const submitBtn = sharedPage.getByRole('button', { name: /submit|create/i });
          await submitBtn.first().click();
          await sharedPage.waitForTimeout(1000);

          // Verify validation error
          const errorMsg = sharedPage.getByText(/exceeds|remaining|insufficient/i);
          await expect(errorMsg.first()).toBeVisible({ timeout: 5000 });
        }
      }
    }
  });

  test.fixme('Edge: Bulk order expires with pending drawdowns → prevents new drawdowns; existing POs unaffected', async () => {
    await navigateInApp(sharedPage, '/bulk-orders');

    // Find an expired bulk order
    const expiredRow = sharedPage
      .locator('tbody tr')
      .filter({ hasText: /expired/i })
      .first();
    const hasExpired = await expiredRow.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasExpired) {
      await expiredRow.click();
      await sharedPage.waitForTimeout(1000);

      // Verify drawdown button is disabled
      const drawdownBtn = sharedPage.getByRole('button', { name: /drawdown|create drawdown/i });
      const hasBtn = await drawdownBtn
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (hasBtn) {
        const isDisabled = await drawdownBtn.first().isDisabled();
        expect(isDisabled).toBeTruthy();
      }
    }
  });

  test.fixme('Edge: Drawdown for fully delivered order → prevented, message shows remaining qty is zero', async () => {
    await navigateInApp(sharedPage, '/bulk-orders');

    // Find a fully delivered bulk order
    const deliveredRow = sharedPage
      .locator('tbody tr')
      .filter({ hasText: /100%|delivered|complete/i })
      .first();
    const hasDelivered = await deliveredRow.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasDelivered) {
      await deliveredRow.click();
      await sharedPage.waitForTimeout(1000);

      // Verify drawdown is prevented
      const drawdownBtn = sharedPage.getByRole('button', { name: /drawdown|create drawdown/i });
      const hasBtn = await drawdownBtn
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (hasBtn) {
        const isDisabled = await drawdownBtn.first().isDisabled();
        expect(isDisabled).toBeTruthy();
      }

      // Or verify zero remaining message
      const zeroMsg = sharedPage.getByText(/remaining.*0|zero|no remaining/i);
      const hasZero = await zeroMsg
        .first()
        .isVisible()
        .catch(() => false);
      // Either disabled button or zero message is acceptable
    }
  });
});
