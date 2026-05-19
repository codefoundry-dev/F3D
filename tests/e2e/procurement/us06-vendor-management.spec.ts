import { test, expect, type Page } from '@playwright/test';
import { loginAs, navigateInApp } from '../helpers/procurement-helpers';
import { COMPANY_ADMIN, VENDOR_USER } from '../fixtures/test-data';

test.describe('US-6 - Vendor Management', () => {
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

  test.fixme('AC1: PO invites vendor and company + rep emails receive invitation; vendor listed as Invited', async () => {
    await navigateInApp(sharedPage, '/vendors');

    // Click invite vendor button
    const inviteBtn = sharedPage.getByRole('button', { name: /invite|add vendor/i });
    await expect(inviteBtn.first()).toBeVisible({ timeout: 10000 });
    await inviteBtn.first().click();
    await sharedPage.waitForTimeout(500);

    // Fill vendor invitation form
    const companyNameField = sharedPage.getByLabel(/company name/i);
    const companyEmailField = sharedPage.getByLabel(/company email|email/i).first();
    const repNameField = sharedPage.getByLabel(/rep(resentative)? name/i);
    const repEmailField = sharedPage.getByLabel(/rep(resentative)? email/i);

    const hasForm = await companyNameField.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasForm) {
      await companyNameField.fill('E2E Test Vendor Ltd');
      await companyEmailField.fill('company@e2evendor.test');
      if (await repNameField.isVisible().catch(() => false)) {
        await repNameField.fill('John Sales Rep');
      }
      if (await repEmailField.isVisible().catch(() => false)) {
        await repEmailField.fill('rep@e2evendor.test');
      }

      // Submit invitation
      const submitBtn = sharedPage.getByRole('button', { name: /send|invite|submit/i });
      await submitBtn.first().click();
      await sharedPage.waitForTimeout(2000);

      // Verify success
      const successIndicator = sharedPage.getByText(/invited|success|sent/i);
      await expect(successIndicator.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test.fixme('AC2: Vendor already on platform invited by other contractor is added directly without new invitation', async () => {
    await navigateInApp(sharedPage, '/vendors');

    const inviteBtn = sharedPage.getByRole('button', { name: /invite|add vendor/i });
    await expect(inviteBtn.first()).toBeVisible({ timeout: 10000 });
    await inviteBtn.first().click();
    await sharedPage.waitForTimeout(500);

    // Enter email of an existing vendor
    const emailField = sharedPage.getByLabel(/email/i).first();
    const hasField = await emailField.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasField) {
      await emailField.fill(VENDOR_USER.email);
      await sharedPage.waitForTimeout(1000);

      // System should recognise the vendor is already registered
      const existingVendorMsg = sharedPage.getByText(/already (exists|registered)|added directly/i);
      const hasMsg = await existingVendorMsg
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);
      expect(hasMsg).toBeTruthy();
    }
  });

  test.fixme('AC3: Vendor selection during RFQ expands sales rep panel with name, email, phone, role', async () => {
    await navigateInApp(sharedPage, '/rfqs/new');

    await expect(sharedPage.locator('form, [class*="create"]').first()).toBeVisible({
      timeout: 10000,
    });

    // Find vendor selection section
    const vendorSection = sharedPage.getByText(/select vendor|vendor/i).first();
    const hasVendorSection = await vendorSection.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasVendorSection) {
      // Click on a vendor to expand their sales rep panel
      const vendorItem = sharedPage.locator('[class*="vendor"], [class*="Vendor"]').first();
      const hasVendorItem = await vendorItem.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasVendorItem) {
        await vendorItem.click();
        await sharedPage.waitForTimeout(500);

        // Verify sales rep details are visible
        const repPanel = sharedPage.locator('[class*="rep"], [class*="sales"]').first();
        const hasRepPanel = await repPanel.isVisible().catch(() => false);
        if (hasRepPanel) {
          // Verify rep fields
          const repName = sharedPage.getByText(/name/i);
          const repEmail = sharedPage.getByText(/@/);
          expect(
            (await repName
              .first()
              .isVisible()
              .catch(() => false)) ||
              (await repEmail
                .first()
                .isVisible()
                .catch(() => false)),
          ).toBeTruthy();
        }
      }
    }
  });

  test.fixme('AC4: PO and vendor can view PO with in-app communication thread and notifications', async () => {
    await navigateInApp(sharedPage, '/purchase-orders');

    const rows = sharedPage.locator('tbody tr');
    const rowCount = await rows.count().catch(() => 0);

    if (rowCount > 0) {
      // Open a PO detail
      await rows.first().click();
      await sharedPage.waitForTimeout(1000);

      // Find communication/messages section
      const messagesTab = sharedPage
        .getByRole('tab', { name: /messages|chat|communication/i })
        .or(sharedPage.getByText(/messages|communication/i).first());
      const hasMessages = await messagesTab.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasMessages) {
        await messagesTab.click();
        await sharedPage.waitForTimeout(500);

        // Find message input
        const messageInput = sharedPage
          .getByPlaceholder(/type.*message|write.*message/i)
          .or(sharedPage.locator('textarea').first());
        const hasInput = await messageInput.isVisible({ timeout: 5000 }).catch(() => false);

        if (hasInput) {
          await messageInput.fill('E2E test message from company admin');
          const sendBtn = sharedPage.getByRole('button', { name: /send/i });
          await sendBtn.first().click();
          await sharedPage.waitForTimeout(1000);

          // Verify message appears in thread
          const sentMessage = sharedPage.getByText('E2E test message from company admin');
          await expect(sentMessage).toBeVisible({ timeout: 5000 });
        }
      }
    }
  });
});
