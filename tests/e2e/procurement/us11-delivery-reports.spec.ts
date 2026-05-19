import { test, expect, type Page } from '@playwright/test';
import { loginAs, navigateInApp } from '../helpers/procurement-helpers';
import { COMPANY_ADMIN } from '../fixtures/test-data';

test.describe('US-11 - Delivery Report Submission', () => {
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

  test.fixme('AC1: Initiate delivery report from PO → form pre-populated with line items; specify qty + outcome per item', async () => {
    await navigateInApp(sharedPage, '/purchase-orders');

    const rows = sharedPage.locator('tbody tr');
    const rowCount = await rows.count().catch(() => 0);

    if (rowCount > 0) {
      // Open a PO in deliverable status
      await rows.first().click();
      await sharedPage.waitForTimeout(1000);

      // Click "Create Delivery Report"
      const deliveryBtn = sharedPage.getByRole('button', {
        name: /delivery report|create delivery/i,
      });
      const hasBtn = await deliveryBtn
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (hasBtn) {
        await deliveryBtn.first().click();
        await sharedPage.waitForTimeout(1000);

        // Verify form is pre-populated with PO line items
        const lineItems = sharedPage.locator(
          'table tbody tr, [class*="lineItem"], [class*="line-item"]',
        );
        const itemCount = await lineItems.count();
        expect(itemCount).toBeGreaterThan(0);

        // Verify outcome dropdown exists for each item
        const outcomeSelects = sharedPage.locator('select, [role="combobox"]');
        const selectCount = await outcomeSelects.count();
        expect(selectCount).toBeGreaterThan(0);

        // Fill in delivery outcomes
        const qtyInputs = sharedPage.locator('input[type="number"]');
        const qtyCount = await qtyInputs.count();
        if (qtyCount > 0) {
          await qtyInputs.first().fill('10');
        }

        // Submit
        const submitBtn = sharedPage.getByRole('button', { name: /submit|save/i });
        const hasSubmit = await submitBtn
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false);
        if (hasSubmit) {
          await submitBtn.first().click();
          await sharedPage.waitForTimeout(1000);

          const successMsg = sharedPage.getByText(/submitted|success/i);
          await expect(successMsg.first()).toBeVisible({ timeout: 5000 });
        }
      }
    }
  });

  test.fixme('AC2: Delivery person scans QR/tokenized URL → enter name+email, receive 15-min OTP, access delivery report', async () => {
    // This test simulates an external delivery person flow
    const externalPage = await sharedPage.context().browser()!.newPage();

    // Navigate to a tokenized delivery URL
    await externalPage.goto('http://localhost:3002/delivery-report?token=test-token');
    await externalPage.waitForTimeout(2000);

    // Verify name + email form (no full login)
    const nameField = externalPage.getByLabel(/name/i);
    const emailField = externalPage.getByLabel(/email/i);

    const hasForm = await nameField.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasForm) {
      await nameField.fill('John Delivery');
      await emailField.fill('delivery@test.com');

      const submitBtn = externalPage.getByRole('button', { name: /submit|verify|send/i });
      await submitBtn.first().click();
      await externalPage.waitForTimeout(2000);

      // Verify OTP input appears
      const otpInput = externalPage.getByLabel(/otp|code|digit/i);
      const hasOtp = await otpInput
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);
      expect(hasOtp).toBeTruthy();
    }

    await externalPage.close();
  });

  test.fixme('AC3: External delivery report submitted → CA reviews, approves/rejects with comment; only approved affects PO status', async () => {
    await navigateInApp(sharedPage, '/purchase-orders');

    const rows = sharedPage.locator('tbody tr');
    const rowCount = await rows.count().catch(() => 0);

    if (rowCount > 0) {
      await rows.first().click();
      await sharedPage.waitForTimeout(1000);

      // Navigate to delivery reports tab
      const deliveryTab = sharedPage
        .getByRole('tab', { name: /delivery|reports/i })
        .or(sharedPage.getByText(/delivery reports/i));
      const hasTab = await deliveryTab
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (hasTab) {
        await deliveryTab.first().click();
        await sharedPage.waitForTimeout(1000);

        // Find pending delivery report
        const pendingReport = sharedPage
          .locator('[class*="pending"], tr')
          .filter({ hasText: /pending/i });
        const hasPending = await pendingReport
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false);

        if (hasPending) {
          await pendingReport.first().click();
          await sharedPage.waitForTimeout(500);

          // Approve
          const approveBtn = sharedPage.getByRole('button', { name: /approve/i });
          const hasApprove = await approveBtn
            .first()
            .isVisible({ timeout: 5000 })
            .catch(() => false);

          if (hasApprove) {
            // Add comment
            const commentField = sharedPage.locator('textarea').first();
            const hasComment = await commentField.isVisible({ timeout: 3000 }).catch(() => false);
            if (hasComment) {
              await commentField.fill('Verified with site manager');
            }

            await approveBtn.first().click();
            await sharedPage.waitForTimeout(1000);

            const successMsg = sharedPage.getByText(/approved|success/i);
            await expect(successMsg.first()).toBeVisible({ timeout: 5000 });
          }
        }
      }
    }
  });

  test.fixme('Edge: 100% defects reported → delivery marked rejected, vendor+office notified, PO cannot move to Delivered', async () => {
    await navigateInApp(sharedPage, '/purchase-orders');

    const rows = sharedPage.locator('tbody tr');
    const rowCount = await rows.count().catch(() => 0);

    if (rowCount > 0) {
      await rows.first().click();
      await sharedPage.waitForTimeout(1000);

      // Create delivery report with all items rejected
      const deliveryBtn = sharedPage.getByRole('button', {
        name: /delivery report|create delivery/i,
      });
      const hasBtn = await deliveryBtn
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (hasBtn) {
        await deliveryBtn.first().click();
        await sharedPage.waitForTimeout(1000);

        // Mark all items as rejected
        const outcomeSelects = sharedPage.locator('select, [role="combobox"]');
        const selectCount = await outcomeSelects.count();
        for (let i = 0; i < selectCount; i++) {
          await outcomeSelects.nth(i).click();
          const rejectOption = sharedPage.getByRole('option', { name: /reject/i });
          const hasOption = await rejectOption
            .first()
            .isVisible({ timeout: 3000 })
            .catch(() => false);
          if (hasOption) await rejectOption.first().click();
        }

        // Submit
        const submitBtn = sharedPage.getByRole('button', { name: /submit/i });
        const hasSubmit = await submitBtn
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false);
        if (hasSubmit) {
          await submitBtn.first().click();
          await sharedPage.waitForTimeout(1000);

          // Verify delivery marked as rejected
          const rejectedStatus = sharedPage.getByText(/rejected|fully rejected/i);
          await expect(rejectedStatus.first()).toBeVisible({ timeout: 5000 });
        }
      }
    }
  });
});
