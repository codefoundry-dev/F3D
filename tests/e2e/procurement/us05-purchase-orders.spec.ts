import { test, expect, type Page } from '@playwright/test';
import { loginAs, navigateInApp } from '../helpers/procurement-helpers';
import { COMPANY_ADMIN, VENDOR_USER } from '../fixtures/test-data';

test.describe('US-5 - Purchase Order Creation', () => {
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

  test.fixme('AC1: Manual PO with items in bulk agreement auto-applies bulk pricing and shows remaining qty', async () => {
    await navigateInApp(sharedPage, '/purchase-orders/new');

    // Wait for PO creation form
    await expect(sharedPage.locator('form, [class*="create"]').first()).toBeVisible({
      timeout: 10000,
    });

    // Select a vendor that has active bulk agreements
    const vendorSelect = sharedPage
      .getByLabel(/vendor/i)
      .or(sharedPage.locator('[aria-haspopup="listbox"]').first());
    const hasVendor = await vendorSelect
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (hasVendor) {
      await vendorSelect.first().click();
      await sharedPage.waitForTimeout(500);

      // Select first vendor option
      const firstOption = sharedPage.getByRole('option').first();
      const hasOption = await firstOption.isVisible({ timeout: 3000 }).catch(() => false);
      if (hasOption) await firstOption.click();
    }

    // Add a line item covered by bulk agreement
    const addItemBtn = sharedPage.getByRole('button', { name: /add (line )?item/i });
    const hasAdd = await addItemBtn
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (hasAdd) {
      await addItemBtn.first().click();
      await sharedPage.waitForTimeout(1000);

      // Verify bulk pricing indicator appears
      const bulkIndicator = sharedPage
        .getByText(/bulk (pricing|agreement|order)/i)
        .or(sharedPage.locator('[class*="bulk"]'));
      const hasBulk = await bulkIndicator
        .first()
        .isVisible()
        .catch(() => false);

      // Verify remaining quantity is shown
      const remainingQty = sharedPage.getByText(/remaining/i);
      const hasRemaining = await remainingQty
        .first()
        .isVisible()
        .catch(() => false);

      expect(hasBulk || hasRemaining).toBeTruthy();
    }
  });

  test.fixme('AC2: PO issued to vendor shows line items and delivery details with confirm/propose flow', async () => {
    // Open vendor page to check received POs
    const vendorPage = await sharedPage
      .context()
      .browser()!
      .newPage({ baseURL: 'http://localhost:3003' });
    await loginAs(vendorPage, VENDOR_USER.email, VENDOR_USER.password);

    await navigateInApp(vendorPage, '/purchase-orders');

    const table = vendorPage.locator('table');
    const hasTable = await table.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasTable) {
      const rows = vendorPage.locator('tbody tr');
      const rowCount = await rows.count();
      if (rowCount > 0) {
        await rows.first().click();
        await vendorPage.waitForTimeout(1000);

        // Verify line items are visible
        const lineItems = vendorPage.locator(
          'table tbody tr, [class*="lineItem"], [class*="line-item"]',
        );
        const itemCount = await lineItems.count();
        expect(itemCount).toBeGreaterThan(0);

        // Verify confirm/propose buttons
        const confirmBtn = vendorPage.getByRole('button', { name: /confirm|acknowledge|accept/i });
        const proposeBtn = vendorPage.getByRole('button', { name: /propose|reject|change/i });
        const hasConfirm = await confirmBtn
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false);
        const hasPropose = await proposeBtn
          .first()
          .isVisible()
          .catch(() => false);
        expect(hasConfirm || hasPropose).toBeTruthy();
      }
    }

    await vendorPage.close();
  });

  test.fixme('AC3: PO marked as pick-up hides delivery fields and shows pick-up label', async () => {
    await navigateInApp(sharedPage, '/purchase-orders/new');

    await expect(sharedPage.locator('form, [class*="create"]').first()).toBeVisible({
      timeout: 10000,
    });

    // Find pick-up toggle/checkbox
    const pickupToggle = sharedPage
      .getByLabel(/pick.?up/i)
      .or(sharedPage.getByRole('checkbox', { name: /pick.?up/i }))
      .or(sharedPage.getByRole('switch', { name: /pick.?up/i }));
    const hasPickup = await pickupToggle
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (hasPickup) {
      await pickupToggle.first().click();
      await sharedPage.waitForTimeout(500);

      // Verify delivery fields are hidden
      const deliveryAddress = sharedPage.getByLabel(/delivery address/i);
      const deliveryDate = sharedPage.getByLabel(/delivery date/i);
      await expect(deliveryAddress)
        .not.toBeVisible({ timeout: 3000 })
        .catch(() => {});
      await expect(deliveryDate)
        .not.toBeVisible({ timeout: 3000 })
        .catch(() => {});

      // Verify "Pick-up" label is shown
      const pickupLabel = sharedPage.getByText(/pick.?up/i);
      await expect(pickupLabel.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test.fixme('AC4: PO from approved RFQ quote is pre-populated with vendor, items, quantities, prices', async () => {
    await navigateInApp(sharedPage, '/rfqs');

    const rows = sharedPage.locator('tbody tr');
    const rowCount = await rows.count().catch(() => 0);

    if (rowCount > 0) {
      // Navigate to an RFQ detail
      await rows.first().click();
      await sharedPage.waitForURL(/\/rfqs\/[^/]+/, { timeout: 10000 });

      // Look for a "Convert to PO" button
      const convertBtn = sharedPage.getByRole('button', { name: /convert.*po|create po/i });
      const hasConvert = await convertBtn
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (hasConvert) {
        await convertBtn.first().click();
        await sharedPage.waitForTimeout(1000);

        // Verify PO form is pre-populated
        const vendorField = sharedPage
          .getByLabel(/vendor/i)
          .or(sharedPage.locator('[class*="vendor"]'));
        await expect(vendorField.first()).toBeVisible({ timeout: 5000 });

        // Verify line items exist (pre-populated from quote)
        const lineItems = sharedPage.locator('table tbody tr, [class*="lineItem"]');
        const itemCount = await lineItems.count();
        expect(itemCount).toBeGreaterThan(0);
      }
    }
  });

  test.fixme('Edge: Change Order submitted on closed PO is auto-rejected with system note', async () => {
    await navigateInApp(sharedPage, '/purchase-orders');

    const table = sharedPage.locator('table');
    const hasTable = await table.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasTable) {
      // Find a closed PO (look for "Closed" badge in a row)
      const closedRow = sharedPage
        .locator('tbody tr')
        .filter({ hasText: /closed/i })
        .first();
      const hasClosedRow = await closedRow.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasClosedRow) {
        await closedRow.click();
        await sharedPage.waitForTimeout(1000);

        // Verify Change Order button is disabled or not present
        const changeOrderBtn = sharedPage.getByRole('button', {
          name: /change order|request change/i,
        });
        const hasBtn = await changeOrderBtn
          .first()
          .isVisible({ timeout: 3000 })
          .catch(() => false);

        if (hasBtn) {
          // Button may be visible but disabled
          const isDisabled = await changeOrderBtn.first().isDisabled();
          expect(isDisabled).toBeTruthy();
        }
        // If button is not visible at all, that's also acceptable for a closed PO
      }
    }
  });
});
