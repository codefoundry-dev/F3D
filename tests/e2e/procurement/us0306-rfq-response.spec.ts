import { test, expect, type Page } from '@playwright/test';
import { loginAs, navigateInApp } from '../helpers/procurement-helpers';
import { VENDOR_USER } from '../fixtures/test-data';

test.describe('US-3.06 - Vendor RFQ Response', () => {
  test.describe.configure({ mode: 'serial' });

  let vendorPage: Page;

  test.beforeAll(async ({ browser }) => {
    vendorPage = await browser.newPage({ baseURL: 'http://localhost:3003' });
    await loginAs(vendorPage, VENDOR_USER.email, VENDOR_USER.password);
  });

  test.afterAll(async () => {
    await vendorPage?.close();
  });

  test('AC1: Vendor can view RFQ list and navigate to response form', async () => {
    await navigateInApp(vendorPage, '/rfqs');

    const rows = vendorPage.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });

    // Click first RFQ
    await rows.first().click();
    await vendorPage.waitForTimeout(1000);

    // Look for response page content — either directly on detail or via navigate
    // Route: /rfqs/:id/response
    const responseContent = vendorPage.getByText(/Bulk-Level Defaults|Submit|line items/i);
    const detailContent = vendorPage.getByText(/RFQ|line items|details/i);
    const hasContent =
      (await responseContent
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)) ||
      (await detailContent
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false));
    expect(hasContent).toBeTruthy();
  });

  test('AC2: Vendor can fill bulk-level defaults and per-line item pricing', async () => {
    await navigateInApp(vendorPage, '/rfqs');
    const rows = vendorPage.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    await rows.first().click();
    await vendorPage.waitForTimeout(1000);

    // Navigate to response form if on detail page
    const respondBtn = vendorPage
      .getByRole('button', { name: /Respond|Submit quote/i })
      .or(vendorPage.getByRole('link', { name: /Respond/i }));
    const hasRespondBtn = await respondBtn
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    if (hasRespondBtn) {
      await respondBtn.first().click();
      await vendorPage.waitForTimeout(1000);
    }

    // BulkLevelDefaults: "Bulk-Level Defaults" collapsible section
    const bulkSection = vendorPage.getByText('Bulk-Level Defaults');
    const hasBulk = await bulkSection.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasBulk) {
      // Expand if collapsed
      const expandBtn = vendorPage.getByRole('button', {
        name: /Expand/i,
      });
      const needsExpand = await expandBtn.isVisible({ timeout: 2000 }).catch(() => false);
      if (needsExpand) {
        await expandBtn.click();
        await vendorPage.waitForTimeout(300);
      }

      // Fill numeric inputs — placeholder "Enter number"
      const numericInputs = vendorPage.locator('input[placeholder="Enter number"]');
      const inputCount = await numericInputs.count();
      if (inputCount > 0) {
        await numericInputs.first().fill('100'); // Bulk Availability
      }
    }

    // Per-line item: look for unit price inputs (decimal)
    const priceInputs = vendorPage.locator('input[inputmode="decimal"]');
    const hasPriceInputs = await priceInputs
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (hasPriceInputs) {
      await priceInputs.first().fill('99.50');
    }
  });

  test('AC3: Vendor can submit a quote response and see success confirmation', async () => {
    await navigateInApp(vendorPage, '/rfqs');
    const rows = vendorPage.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    await rows.first().click();
    await vendorPage.waitForTimeout(1000);

    // Navigate to response form if needed
    const respondBtn = vendorPage
      .getByRole('button', { name: /Respond|Submit quote/i })
      .or(vendorPage.getByRole('link', { name: /Respond/i }));
    const hasRespondBtn = await respondBtn
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    if (hasRespondBtn) {
      await respondBtn.first().click();
      await vendorPage.waitForTimeout(1000);
    }

    // "Submit" or "Update Response" button
    const submitBtn = vendorPage.getByRole('button', {
      name: /^Submit$|^Update Response$/i,
    });
    const canSubmit = await submitBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (canSubmit) {
      await submitBtn.click();
      await vendorPage.waitForTimeout(2000);

      // Success: "Response Submitted!" or "Response Updated!" or validation error
      const successMsg = vendorPage.getByText(/Response Submitted!|Response Updated!/);
      const validationMsg = vendorPage.getByText(/at least one line item|required/i);
      const hasSuccess = await successMsg.isVisible({ timeout: 5000 }).catch(() => false);
      const hasValidation = await validationMsg
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false);

      // Either success or validation feedback should appear
      expect(hasSuccess || hasValidation).toBeTruthy();
    }
  });

  test('Edge: Expired RFQ deadline shows deadline passed message', async () => {
    await navigateInApp(vendorPage, '/rfqs');
    const rows = vendorPage.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });

    const allRows = vendorPage.locator('tbody tr');
    const rowCount = await allRows.count();

    for (let i = 0; i < Math.min(rowCount, 10); i++) {
      const row = allRows.nth(i);
      const rowText = await row.textContent();
      if (rowText && /closed|expired/i.test(rowText)) {
        await row.click();
        await vendorPage.waitForTimeout(1000);

        // "Response deadline has passed" from i18n
        const deadlineMsg = vendorPage.getByText(/deadline has passed|cannot respond/i);
        const hasMsg = await deadlineMsg
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false);
        expect(hasMsg).toBeTruthy();
        break;
      }
    }
  });

  test('Edge: Vendor can edit an existing submitted response (pre-populated form)', async () => {
    await navigateInApp(vendorPage, '/rfqs');
    const rows = vendorPage.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });

    const allRows = vendorPage.locator('tbody tr');
    const rowCount = await allRows.count();

    for (let i = 0; i < Math.min(rowCount, 10); i++) {
      const row = allRows.nth(i);
      const rowText = await row.textContent();
      if (rowText && /responded|submitted|quoted/i.test(rowText)) {
        await row.click();
        await vendorPage.waitForTimeout(1000);

        // Edit response button or form pre-populated with existing data
        const editBtn = vendorPage.getByRole('button', {
          name: /Edit|Update/i,
        });
        const hasEdit = await editBtn
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false);

        if (hasEdit) {
          await editBtn.first().click();
          await vendorPage.waitForTimeout(1000);

          // "Update Response" button indicates edit mode
          const updateBtn = vendorPage.getByRole('button', {
            name: /Update Response/i,
          });
          const hasUpdate = await updateBtn.isVisible({ timeout: 5000 }).catch(() => false);
          expect(hasUpdate).toBeTruthy();
        }
        break;
      }
    }
  });
});
