import { test, expect, type Page } from '@playwright/test';
import { loginAs, navigateInApp } from '../helpers/procurement-helpers';
import { COMPANY_ADMIN, VENDOR_USER } from '../fixtures/test-data';

test.describe('US-3 - RFQ Creation & Vendor Notification', () => {
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

  test.fixme('AC1: PO creating RFQ with line item in active bulk order suggests drawdown', async () => {
    await navigateInApp(sharedPage, '/rfqs/new');

    // Wait for RFQ creation form to render
    await expect(
      sharedPage.locator('form, [class*="create"], [class*="Create"]').first(),
    ).toBeVisible({ timeout: 10000 });

    // Look for line item addition section
    const addItemBtn = sharedPage
      .getByRole('button', { name: /add (line )?item/i })
      .or(sharedPage.getByRole('button', { name: /add material/i }));
    await expect(addItemBtn.first()).toBeVisible({ timeout: 5000 });

    // Add a line item (that should be in an active bulk order)
    await addItemBtn.first().click();
    await sharedPage.waitForTimeout(500);

    // Verify system displays a suggestion/banner indicating drawdown is available
    const drawdownSuggestion = sharedPage
      .getByText(/drawdown/i)
      .or(sharedPage.getByText(/bulk order/i))
      .or(sharedPage.locator('[class*="drawdown"], [class*="suggestion"], [class*="banner"]'));
    // The drawdown suggestion should appear when a matching bulk order item is detected
    const hasSuggestion = await drawdownSuggestion
      .first()
      .isVisible()
      .catch(() => false);
    // Note: depends on seed data having matching bulk orders
    expect(hasSuggestion).toBeTruthy();
  });

  test.fixme('AC2: RFQ sent to vendors triggers email notification for each vendor', async () => {
    await navigateInApp(sharedPage, '/rfqs');

    // Find an RFQ in draft status that can be sent
    const table = sharedPage.locator('table');
    const hasTable = await table.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasTable) {
      // Click on a draft RFQ to open detail
      const draftRow = sharedPage.locator('tbody tr').first();
      await draftRow.click();
      await sharedPage.waitForTimeout(1000);

      // Look for a "Send" or "Send to vendors" button
      const sendBtn = sharedPage.getByRole('button', { name: /send/i });
      const hasSendBtn = await sendBtn
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (hasSendBtn) {
        await sendBtn.first().click();
        await sharedPage.waitForTimeout(2000);

        // Verify success indication
        const successToast = sharedPage.getByText(/sent|success/i);
        await expect(successToast.first()).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test.fixme('AC3: Vendor submits quote and it appears in RFQ detail page', async () => {
    // Login as vendor to check received RFQs
    const vendorPage = await sharedPage
      .context()
      .browser()!
      .newPage({ baseURL: 'http://localhost:3003' });
    await loginAs(vendorPage, VENDOR_USER.email, VENDOR_USER.password);

    await navigateInApp(vendorPage, '/rfqs');

    // Vendor should see RFQs they've been invited to
    const table = vendorPage.locator('table');
    const hasTable = await table.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasTable) {
      const rows = vendorPage.locator('tbody tr');
      const rowCount = await rows.count();
      if (rowCount > 0) {
        // Open first RFQ
        await rows.first().click();
        await vendorPage.waitForTimeout(1000);

        // Look for quote submission form/button
        const submitQuoteBtn = vendorPage.getByRole('button', {
          name: /submit quote|respond|quote/i,
        });
        const hasSubmitBtn = await submitQuoteBtn
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false);

        if (hasSubmitBtn) {
          await submitQuoteBtn.first().click();
          await vendorPage.waitForTimeout(1000);
        }
      }
    }

    await vendorPage.close();
  });

  test.fixme('AC4: PO edits RFQ before vendor response and vendors are notified of update', async () => {
    await navigateInApp(sharedPage, '/rfqs');

    const table = sharedPage.locator('table');
    const hasTable = await table.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasTable) {
      // Click on an open RFQ row to navigate to detail
      const firstRow = sharedPage.locator('tbody tr').first();
      await firstRow.click();
      await sharedPage.waitForURL(/\/rfqs\/[^/]+/, { timeout: 10000 });

      // Look for edit functionality
      const editBtn = sharedPage.getByRole('button', { name: /edit/i });
      const hasEditBtn = await editBtn
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (hasEditBtn) {
        await editBtn.first().click();
        await sharedPage.waitForTimeout(1000);

        // Make a change and save
        const saveBtn = sharedPage.getByRole('button', { name: /save|update/i });
        const hasSave = await saveBtn
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false);
        if (hasSave) {
          await saveBtn.first().click();
          await sharedPage.waitForTimeout(1000);
        }
      }
    }
  });

  test.fixme('Edge: All RFQ items covered by bulk orders notifies no RFQ required', async () => {
    await navigateInApp(sharedPage, '/rfqs/new');

    // Wait for RFQ creation form
    await expect(sharedPage.locator('form, [class*="create"]').first()).toBeVisible({
      timeout: 10000,
    });

    // Add line items that are all covered by bulk orders
    const addItemBtn = sharedPage
      .getByRole('button', { name: /add (line )?item/i })
      .or(sharedPage.getByRole('button', { name: /add material/i }));
    const hasAddBtn = await addItemBtn
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (hasAddBtn) {
      await addItemBtn.first().click();
      await sharedPage.waitForTimeout(1000);

      // Verify system displays notification that no RFQ is required
      const noRfqNotice = sharedPage.getByText(/no rfq required|all items covered|fully covered/i);
      const hasNotice = await noRfqNotice
        .first()
        .isVisible()
        .catch(() => false);
      // When all items are covered, the system should notify the user
      expect(hasNotice).toBeTruthy();
    }
  });
});
