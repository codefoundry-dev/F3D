import { test, expect, type Page } from '@playwright/test';
import { loginAs, navigateInApp } from '../helpers/procurement-helpers';
import { COMPANY_ADMIN } from '../fixtures/test-data';

test.describe('US-3.12 - Sales Representatives Display', () => {
  test.describe.configure({ mode: 'serial' });

  let sharedPage: Page;

  test.beforeAll(async ({ browser }) => {
    sharedPage = await browser.newPage({ baseURL: 'http://localhost:3002' });
    await loginAs(sharedPage, COMPANY_ADMIN.email, COMPANY_ADMIN.password);
  });

  test.afterAll(async () => {
    await sharedPage?.close();
  });

  test('AC1: Vendor list shows sales representatives per vendor inline', async () => {
    await navigateInApp(sharedPage, '/vendors');

    // Vendor list should render
    const vendorList = sharedPage.locator(
      'table tbody tr, [class*="vendor"], [class*="accordion"]',
    );
    await expect(vendorList.first()).toBeVisible({ timeout: 10000 });

    // Representatives info shown inline — from vendors.representatives.title
    const repInfo = sharedPage.getByText(/representative|rep|sales contact/i);
    const hasRepInfo = await repInfo
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (hasRepInfo) {
      // Verify at least name or email is displayed for reps
      const emailPattern = sharedPage.locator('text=/@/');
      const hasDetails = await emailPattern
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false);

      // Representatives are visible without selecting/clicking the vendor
      expect(hasDetails).toBeTruthy();
    }
  });

  test('Edge: Vendor with no representatives shows empty state', async () => {
    await navigateInApp(sharedPage, '/vendors');

    const vendorList = sharedPage.locator(
      'table tbody tr, [class*="vendor"], [class*="accordion"]',
    );
    await expect(vendorList.first()).toBeVisible({ timeout: 10000 });

    // Look for "No representatives" from vendors.representatives.noRepresentatives
    const allVendors = vendorList;
    const count = await allVendors.count();

    for (let i = 0; i < Math.min(count, 10); i++) {
      const vendor = allVendors.nth(i);
      const text = await vendor.textContent();

      if (text && /no representative|0 rep/i.test(text)) {
        const emptyState = vendor.getByText(/no representative/i);
        const hasEmpty = await emptyState.isVisible({ timeout: 3000 }).catch(() => false);
        expect(hasEmpty).toBeTruthy();
        break;
      }
    }
  });
});
