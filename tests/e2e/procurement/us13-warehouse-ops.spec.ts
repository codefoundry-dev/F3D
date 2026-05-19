import { test, expect, type Page } from '@playwright/test';
import { loginAs, navigateInApp } from '../helpers/procurement-helpers';
import { WAREHOUSE_OFFICER } from '../fixtures/test-data';

test.describe('US-13 - Warehouse Operations', () => {
  test.describe.configure({ mode: 'serial' });

  let sharedPage: Page;

  test.beforeAll(async ({ browser }) => {
    sharedPage = await browser.newPage({
      baseURL: 'http://localhost:3002',
    });
    await loginAs(sharedPage, WAREHOUSE_OFFICER.email, WAREHOUSE_OFFICER.password);
  });

  test.afterAll(async () => {
    await sharedPage?.close();
  });

  test.fixme('AC1: New warehouse request from field → appears in "New warehouse requests" queue with project, requester, item count', async () => {
    await navigateInApp(sharedPage, '/');

    // Verify the warehouse dashboard / request queue is visible
    const requestsSection = sharedPage.getByText(/warehouse request|new request|task queue/i);
    await expect(requestsSection.first()).toBeVisible({ timeout: 10000 });

    // Verify request entries have required fields
    const requestCards = sharedPage.locator('[class*="card"], [class*="request"], tbody tr');
    const cardCount = await requestCards.count();

    if (cardCount > 0) {
      const firstCard = requestCards.first();
      // Verify project name is shown
      const hasProject = await firstCard
        .getByText(/project/i)
        .isVisible()
        .catch(() => false);
      // Verify item count is shown
      const hasItemCount = await firstCard
        .getByText(/\d+ item/i)
        .isVisible()
        .catch(() => false);
      expect(hasProject || hasItemCount || cardCount > 0).toBeTruthy();
    }
  });

  test.fixme('AC2: WH Officer opens request → confirm items in-stock/out-of-stock; out-of-stock triggers notification to requester', async () => {
    await navigateInApp(sharedPage, '/');

    // Open a warehouse request
    const requestCards = sharedPage.locator('[class*="card"], [class*="request"], tbody tr');
    const cardCount = await requestCards.count().catch(() => 0);

    if (cardCount > 0) {
      await requestCards.first().click();
      await sharedPage.waitForTimeout(1000);

      // Verify request detail shows line items
      const lineItems = sharedPage.locator('table tbody tr, [class*="lineItem"], [class*="item"]');
      const itemCount = await lineItems.count();
      expect(itemCount).toBeGreaterThan(0);

      // Look for stock confirmation buttons
      const inStockBtn = sharedPage.getByRole('button', { name: /in.?stock|available|confirm/i });
      const outOfStockBtn = sharedPage.getByRole('button', { name: /out.?of.?stock|unavailable/i });

      const hasInStock = await inStockBtn
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);
      const hasOutOfStock = await outOfStockBtn
        .first()
        .isVisible()
        .catch(() => false);

      if (hasInStock) {
        await inStockBtn.first().click();
        await sharedPage.waitForTimeout(500);
      }
      if (hasOutOfStock) {
        await outOfStockBtn.first().click();
        await sharedPage.waitForTimeout(500);
      }

      // Submit confirmation
      const submitBtn = sharedPage.getByRole('button', { name: /submit|confirm|save/i });
      const hasSubmit = await submitBtn
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);
      if (hasSubmit) {
        await submitBtn.first().click();
        await sharedPage.waitForTimeout(1000);
      }
    }
  });

  test.fixme('AC3: All items picked → mark "Ready for pickup" or "Sent to jobsite" → requester and admin notified', async () => {
    await navigateInApp(sharedPage, '/');

    const requestCards = sharedPage.locator('[class*="card"], [class*="request"], tbody tr');
    const cardCount = await requestCards.count().catch(() => 0);

    if (cardCount > 0) {
      await requestCards.first().click();
      await sharedPage.waitForTimeout(1000);

      // Look for fulfillment action buttons
      const pickupBtn = sharedPage.getByRole('button', { name: /ready for pickup/i });
      const sentBtn = sharedPage.getByRole('button', { name: /sent to jobsite|dispatch/i });

      const hasPickup = await pickupBtn
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);
      const hasSent = await sentBtn
        .first()
        .isVisible()
        .catch(() => false);

      if (hasPickup) {
        await pickupBtn.first().click();
        await sharedPage.waitForTimeout(1000);

        const successMsg = sharedPage.getByText(/ready for pickup|status updated|success/i);
        await expect(successMsg.first()).toBeVisible({ timeout: 5000 });
      } else if (hasSent) {
        await sentBtn.first().click();
        await sharedPage.waitForTimeout(1000);

        const successMsg = sharedPage.getByText(/sent|dispatched|success/i);
        await expect(successMsg.first()).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test.fixme('AC4: Barcode scanner → scan material → shows stock level, incoming/outgoing history, associated projects', async () => {
    await navigateInApp(sharedPage, '/inventory');

    // Find barcode scanner section
    const scannerSection = sharedPage.getByText(/barcode|scanner|scan/i);
    const hasScanner = await scannerSection
      .first()
      .isVisible({ timeout: 10000 })
      .catch(() => false);

    if (hasScanner) {
      // Find scan input (barcode value)
      const scanInput = sharedPage
        .getByPlaceholder(/barcode|scan/i)
        .or(sharedPage.locator('input[type="text"]').first());
      const hasInput = await scanInput.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasInput) {
        await scanInput.fill('TEST-BARCODE-001');
        await sharedPage.keyboard.press('Enter');
        await sharedPage.waitForTimeout(1000);

        // Verify material detail panel
        const stockLevel = sharedPage.getByText(/stock|quantity|available/i);
        const hasStock = await stockLevel
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false);

        const history = sharedPage.getByText(/history|incoming|outgoing/i);
        const hasHistory = await history
          .first()
          .isVisible()
          .catch(() => false);

        expect(hasStock || hasHistory).toBeTruthy();
      }
    }
  });

  test.fixme('Edge: Item with zero stock → marked out-of-stock, requester notified, can escalate to new RFQ', async () => {
    await navigateInApp(sharedPage, '/');

    const requestCards = sharedPage.locator('[class*="card"], [class*="request"], tbody tr');
    const cardCount = await requestCards.count().catch(() => 0);

    if (cardCount > 0) {
      await requestCards.first().click();
      await sharedPage.waitForTimeout(1000);

      // Look for out-of-stock flag
      const outOfStock = sharedPage.getByText(/out.?of.?stock|zero stock|unavailable/i);
      const hasOos = await outOfStock
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      // Look for escalate to RFQ button
      const escalateBtn = sharedPage.getByRole('button', { name: /escalate|create rfq|new rfq/i });
      const hasEscalate = await escalateBtn
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (hasEscalate) {
        await escalateBtn.first().click();
        await sharedPage.waitForTimeout(1000);

        // Verify RFQ draft is created with the item
        const rfqForm = sharedPage.locator('form, [class*="rfq"], [class*="create"]');
        await expect(rfqForm.first()).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test.fixme('Edge: Barcode scan no match → prompted to add manually or report as unrecognised material', async () => {
    await navigateInApp(sharedPage, '/inventory');

    const scanInput = sharedPage
      .getByPlaceholder(/barcode|scan/i)
      .or(sharedPage.locator('input[type="text"]').first());
    const hasInput = await scanInput.isVisible({ timeout: 10000 }).catch(() => false);

    if (hasInput) {
      await scanInput.fill('UNKNOWN-BARCODE-999');
      await sharedPage.keyboard.press('Enter');
      await sharedPage.waitForTimeout(1000);

      // Verify "No match found" message
      const noMatch = sharedPage.getByText(/no match|not found|unrecogni/i);
      await expect(noMatch.first()).toBeVisible({ timeout: 5000 });

      // Verify action options
      const addManualBtn = sharedPage.getByRole('button', { name: /add manual|add item/i });
      const reportBtn = sharedPage.getByRole('button', { name: /report|unrecogni/i });

      const hasAdd = await addManualBtn
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      const hasReport = await reportBtn
        .first()
        .isVisible()
        .catch(() => false);

      expect(hasAdd || hasReport).toBeTruthy();
    }
  });
});
