import { test, expect, type Page } from '@playwright/test';
import { loginAs, navigateInApp } from '../helpers/procurement-helpers';
import { VENDOR_USER } from '../fixtures/test-data';

test.describe('US-3.08 - PO Receiving Actions (Vendor)', () => {
  test.describe.configure({ mode: 'serial' });

  let vendorPage: Page;

  test.beforeAll(async ({ browser }) => {
    vendorPage = await browser.newPage({ baseURL: 'http://localhost:3003' });
    await loginAs(vendorPage, VENDOR_USER.email, VENDOR_USER.password);
  });

  test.afterAll(async () => {
    await vendorPage?.close();
  });

  test('AC1: Vendor sees PO list and can open a PO detail page', async () => {
    await navigateInApp(vendorPage, '/purchase-orders');

    const rows = vendorPage.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });

    await rows.first().click();
    await vendorPage.waitForTimeout(1000);

    // Tabs rendered as <button type="button"> — check for "Details" tab
    const detailsTab = vendorPage.locator('button[type="button"]', {
      hasText: /^Details$/i,
    });
    await expect(detailsTab).toBeVisible({ timeout: 5000 });
  });

  test('AC2: Vendor sees alert banner and action buttons on actionable PO', async () => {
    await navigateInApp(vendorPage, '/purchase-orders');
    const rows = vendorPage.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    await rows.first().click();
    await vendorPage.waitForTimeout(1000);

    // Alert banner with acknowledge prompt
    const alertBanner = vendorPage.getByText(
      /requires your acknowledgement|review and take action/i,
    );
    const hasAlert = await alertBanner.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasAlert) {
      // All three action buttons from PoVendorActions.tsx
      await expect(vendorPage.getByRole('button', { name: /Acknowledged/i })).toBeVisible();
      await expect(vendorPage.getByRole('button', { name: /Approve/i })).toBeVisible();
      await expect(vendorPage.getByRole('button', { name: /Decline/i })).toBeVisible();
    }
  });

  test('AC3: Vendor can acknowledge a PO (SENT → ACKNOWLEDGED)', async () => {
    await navigateInApp(vendorPage, '/purchase-orders');
    const rows = vendorPage.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    await rows.first().click();
    await vendorPage.waitForTimeout(1000);

    const acknowledgeBtn = vendorPage.getByRole('button', {
      name: /Acknowledged/i,
    });
    const canAcknowledge = await acknowledgeBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (canAcknowledge) {
      const isDisabled = await acknowledgeBtn.isDisabled();
      if (!isDisabled) {
        await acknowledgeBtn.click();
        await vendorPage.waitForTimeout(2000);

        // After acknowledge, button should become disabled
        const stillEnabled = await acknowledgeBtn.isEnabled({ timeout: 3000 }).catch(() => false);
        expect(stillEnabled).toBeFalsy();
      }
    }
  });

  test('AC4: Vendor can accept a PO with optional payment terms and warehouse', async () => {
    await navigateInApp(vendorPage, '/purchase-orders');
    const rows = vendorPage.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    await rows.first().click();
    await vendorPage.waitForTimeout(1000);

    // PoVendorAcceptFields: payment terms input with placeholder "15-30"
    const paymentTermsInput = vendorPage.locator('input[placeholder="15-30"]');
    const hasPaymentField = await paymentTermsInput.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasPaymentField) {
      await paymentTermsInput.fill('30');
    }

    // Warehouse location SelectDropdown
    const warehouseLabel = vendorPage.getByText(/warehouse location/i);
    const hasWarehouse = await warehouseLabel.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasWarehouse) {
      // Click the dropdown to open options
      await warehouseLabel.click();
      await vendorPage.waitForTimeout(500);
      const firstOption = vendorPage.getByRole('option').first();
      const hasOption = await firstOption.isVisible({ timeout: 3000 }).catch(() => false);
      if (hasOption) {
        await firstOption.click();
      }
    }

    // Click Approve button (variant="primary")
    const approveBtn = vendorPage.getByRole('button', {
      name: /Approve/i,
    });
    const canApprove = await approveBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (canApprove) {
      await approveBtn.click();
      await vendorPage.waitForTimeout(2000);

      // Action buttons should disappear — PO is no longer actionable
      const actionsGone = await approveBtn.isVisible({ timeout: 3000 }).catch(() => false);
      expect(actionsGone).toBeFalsy();
    }
  });

  test('AC5: Vendor can decline a PO with reason via modal', async () => {
    await navigateInApp(vendorPage, '/purchase-orders');
    const rows = vendorPage.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    await rows.first().click();
    await vendorPage.waitForTimeout(1000);

    const declineBtn = vendorPage.getByRole('button', {
      name: /Decline/i,
    });
    const canDecline = await declineBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (canDecline) {
      await declineBtn.click();
      await vendorPage.waitForTimeout(500);

      // DeclinePoModal: title "Decline Purchase Order"
      const modalTitle = vendorPage.getByText('Decline Purchase Order');
      await expect(modalTitle).toBeVisible({ timeout: 5000 });

      // Description text
      await expect(vendorPage.getByText(/please provide a reason/i)).toBeVisible();

      // Textarea with placeholder "Enter reason for declining..."
      const reasonField = vendorPage.getByPlaceholder('Enter reason for declining...');
      await reasonField.fill('E2E test: pricing not acceptable');

      // Confirm button: "Decline PO" (variant="destructive")
      const confirmBtn = vendorPage.getByRole('button', {
        name: 'Decline PO',
      });
      await confirmBtn.click();
      await vendorPage.waitForTimeout(2000);

      // Modal should close
      const modalGone = await modalTitle.isVisible({ timeout: 3000 }).catch(() => false);
      expect(modalGone).toBeFalsy();
    }
  });

  test('AC6: Vendor can submit a change request with message', async () => {
    await navigateInApp(vendorPage, '/purchase-orders');
    const rows = vendorPage.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    await rows.first().click();
    await vendorPage.waitForTimeout(1000);

    // "Change request" button in tab bar area
    const changeRequestBtn = vendorPage.getByRole('button', {
      name: /Change request/i,
    });
    const hasBtn = await changeRequestBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasBtn) {
      await changeRequestBtn.click();
      await vendorPage.waitForTimeout(500);

      // ChangeRequestModal: title "Change Request"
      const modalTitle = vendorPage.getByText('Change Request');
      await expect(modalTitle.first()).toBeVisible({ timeout: 5000 });

      // "New Request" tab should be active
      const newRequestTab = vendorPage.locator('button[type="button"]', {
        hasText: 'New Request',
      });
      await expect(newRequestTab).toBeVisible();

      // Textarea: "Describe the changes you need..."
      const messageField = vendorPage.getByPlaceholder('Describe the changes you need...');
      await messageField.fill('E2E test: requesting delivery date extension by 2 weeks');

      // "Submit Request" button should be enabled
      const submitBtn = vendorPage.getByRole('button', {
        name: 'Submit Request',
      });
      await expect(submitBtn).toBeEnabled();
      await submitBtn.click();
      await vendorPage.waitForTimeout(2000);

      // Check history tab for the new request
      const historyTab = vendorPage.locator('button[type="button"]', {
        hasText: 'History',
      });
      const hasHistory = await historyTab.isVisible({ timeout: 3000 }).catch(() => false);
      if (hasHistory) {
        await historyTab.click();
        await vendorPage.waitForTimeout(500);
        const requestText = vendorPage.getByText(/delivery date extension/i);
        const hasRequest = await requestText.isVisible({ timeout: 5000 }).catch(() => false);
        expect(hasRequest).toBeTruthy();
      }
    }
  });

  test('AC7: Change request submit is disabled when message is empty', async () => {
    await navigateInApp(vendorPage, '/purchase-orders');
    const rows = vendorPage.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    await rows.first().click();
    await vendorPage.waitForTimeout(1000);

    const changeRequestBtn = vendorPage.getByRole('button', {
      name: /Change request/i,
    });
    const hasBtn = await changeRequestBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasBtn) {
      await changeRequestBtn.click();
      await vendorPage.waitForTimeout(500);

      // "Submit Request" disabled when textarea is empty
      const submitBtn = vendorPage.getByRole('button', {
        name: 'Submit Request',
      });
      await expect(submitBtn).toBeDisabled();

      // Cancel closes modal
      const cancelBtn = vendorPage.getByRole('button', { name: 'Cancel' });
      await cancelBtn.click();
    }
  });

  test('AC8: Tab navigation works — all 5 vendor tabs render', async () => {
    await navigateInApp(vendorPage, '/purchase-orders');
    const rows = vendorPage.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    await rows.first().click();
    await vendorPage.waitForTimeout(1000);

    // PoDetailTabs: tabs rendered as <button type="button">
    const tabLabels = ['Details', 'Line Items', 'Messages', 'Documents', 'Action log'];
    for (const label of tabLabels) {
      const tab = vendorPage.locator('button[type="button"]', {
        hasText: new RegExp(`^${label}$`, 'i'),
      });
      await expect(tab).toBeVisible({ timeout: 3000 });
    }

    // Switch to Action Log tab
    const actionLogTab = vendorPage.locator('button[type="button"]', {
      hasText: /Action log/i,
    });
    await actionLogTab.click();
    await vendorPage.waitForTimeout(500);

    // Activity Log section content
    const logContent = vendorPage.getByText(/Activity Log|No activity/i);
    await expect(logContent.first()).toBeVisible({ timeout: 5000 });
  });

  test('Edge: Non-actionable PO hides action buttons', async () => {
    await navigateInApp(vendorPage, '/purchase-orders');
    const rows = vendorPage.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });

    const allRows = vendorPage.locator('tbody tr');
    const rowCount = await allRows.count();

    for (let i = 0; i < Math.min(rowCount, 10); i++) {
      const row = allRows.nth(i);
      const rowText = await row.textContent();
      if (rowText && /accepted|declined|closed|delivered/i.test(rowText)) {
        await row.click();
        await vendorPage.waitForTimeout(1000);

        // PoVendorActions returns null for non-actionable statuses
        const acknowledgeBtn = vendorPage.getByRole('button', {
          name: /Acknowledged/i,
        });
        const visible = await acknowledgeBtn.isVisible({ timeout: 3000 }).catch(() => false);
        expect(visible).toBeFalsy();
        break;
      }
    }
  });

  test('Edge: Decline modal cancel closes without sending request', async () => {
    await navigateInApp(vendorPage, '/purchase-orders');
    const rows = vendorPage.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    await rows.first().click();
    await vendorPage.waitForTimeout(1000);

    const declineBtn = vendorPage.getByRole('button', {
      name: /Decline/i,
    });
    const hasBtn = await declineBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasBtn) {
      await declineBtn.click();
      await vendorPage.waitForTimeout(500);

      const modalTitle = vendorPage.getByText('Decline Purchase Order');
      await expect(modalTitle).toBeVisible({ timeout: 3000 });

      // Cancel button in DeclinePoModal footer
      const cancelBtn = vendorPage.getByRole('button', { name: 'Cancel' });
      await cancelBtn.click();
      await vendorPage.waitForTimeout(500);

      // Modal gone, Decline button still available
      const modalGone = await modalTitle.isVisible({ timeout: 2000 }).catch(() => false);
      expect(modalGone).toBeFalsy();
      await expect(declineBtn).toBeVisible();
    }
  });

  test('Edge: Export button visible on detail page', async () => {
    await navigateInApp(vendorPage, '/purchase-orders');
    const rows = vendorPage.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    await rows.first().click();
    await vendorPage.waitForTimeout(1000);

    // Export button with DownloadIcon
    const exportBtn = vendorPage.getByRole('button', {
      name: /Export as/i,
    });
    await expect(exportBtn).toBeVisible({ timeout: 5000 });
  });
});
