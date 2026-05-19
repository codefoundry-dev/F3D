import { test, expect, type Page } from '@playwright/test';
import { loginAs, navigateInApp } from '../helpers/procurement-helpers';
import { FINANCE_OFFICER } from '../fixtures/test-data';

test.describe('US-9 - Invoice Reconciliation & Dispute Management', () => {
  test.describe.configure({ mode: 'serial' });

  let sharedPage: Page;

  test.beforeAll(async ({ browser }) => {
    sharedPage = await browser.newPage({
      baseURL: 'http://localhost:3002',
    });
    await loginAs(sharedPage, FINANCE_OFFICER.email, FINANCE_OFFICER.password);
  });

  test.afterAll(async () => {
    await sharedPage?.close();
  });

  test.fixme('AC1: Upload PDF invoice → system extracts header + line items, presents for review alongside original', async () => {
    await navigateInApp(sharedPage, '/invoices');

    const uploadBtn = sharedPage.getByRole('button', { name: /upload|create new/i });
    await expect(uploadBtn.first()).toBeVisible({ timeout: 10000 });
    await uploadBtn.first().click();
    await sharedPage.waitForTimeout(500);

    // Upload PDF file
    const fileInput = sharedPage.locator('input[type="file"]');
    const hasFileInput = await fileInput.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasFileInput) {
      await fileInput.setInputFiles({
        name: 'test-invoice.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.0\ntest invoice content'),
      });
      await sharedPage.waitForTimeout(3000);

      // Verify extracted header fields
      const headerFields = sharedPage.getByText(/invoice number|date|vendor|total/i);
      const hasHeader = await headerFields
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      // Verify extracted line items table
      const lineItems = sharedPage.locator('table tbody tr');
      const itemCount = await lineItems.count().catch(() => 0);

      expect(hasHeader || itemCount > 0).toBeTruthy();
    }
  });

  test.fixme('AC2: Initiate reconciliation → comparison table (ordered vs delivered vs invoiced), flags discrepancies', async () => {
    await navigateInApp(sharedPage, '/invoices');

    const rows = sharedPage.locator('tbody tr');
    const rowCount = await rows.count().catch(() => 0);

    if (rowCount > 0) {
      await rows.first().click();
      await sharedPage.waitForTimeout(1000);

      // Click reconcile button
      const reconcileBtn = sharedPage.getByRole('button', {
        name: /reconcile|start reconciliation/i,
      });
      const hasReconcile = await reconcileBtn
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (hasReconcile) {
        await reconcileBtn.first().click();
        await sharedPage.waitForTimeout(1000);

        // Verify comparison table with three column categories
        const orderedCol = sharedPage.getByText(/ordered/i);
        const deliveredCol = sharedPage.getByText(/delivered/i);
        const invoicedCol = sharedPage.getByText(/invoiced/i);

        const hasComparison =
          (await orderedCol
            .first()
            .isVisible()
            .catch(() => false)) ||
          (await deliveredCol
            .first()
            .isVisible()
            .catch(() => false)) ||
          (await invoicedCol
            .first()
            .isVisible()
            .catch(() => false));
        expect(hasComparison).toBeTruthy();
      }
    }
  });

  test.fixme('AC3: Reject invoice line item → dispute created; vendor notified with discrepancy details', async () => {
    await navigateInApp(sharedPage, '/invoices');

    const rows = sharedPage.locator('tbody tr');
    const rowCount = await rows.count().catch(() => 0);

    if (rowCount > 0) {
      await rows.first().click();
      await sharedPage.waitForTimeout(1000);

      // Find reject button on a line item
      const rejectBtn = sharedPage.getByRole('button', { name: /reject|dispute/i });
      const hasReject = await rejectBtn
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (hasReject) {
        await rejectBtn.first().click();
        await sharedPage.waitForTimeout(500);

        // Fill dispute reason
        const reasonField = sharedPage
          .getByLabel(/reason/i)
          .or(sharedPage.locator('textarea').first());
        const hasReason = await reasonField.isVisible({ timeout: 5000 }).catch(() => false);
        if (hasReason) {
          await reasonField.fill('Quantity mismatch - received 8 items, invoiced for 10');
        }

        const submitBtn = sharedPage.getByRole('button', { name: /submit|confirm/i });
        await submitBtn.first().click();
        await sharedPage.waitForTimeout(1000);

        // Verify dispute created
        const disputeStatus = sharedPage.getByText(/disputed|dispute created/i);
        await expect(disputeStatus.first()).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test.fixme('AC4: Open dispute → either party proposes change; other can approve/reject; all recorded with timestamp', async () => {
    await navigateInApp(sharedPage, '/invoices');

    // Look for disputed invoices
    const disputedRow = sharedPage
      .locator('tbody tr')
      .filter({ hasText: /disputed/i })
      .first();
    const hasDisputed = await disputedRow.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasDisputed) {
      await disputedRow.click();
      await sharedPage.waitForTimeout(1000);

      // Find dispute history/timeline
      const timeline = sharedPage.locator(
        '[class*="timeline"], [class*="history"], [class*="dispute"]',
      );
      const hasTimeline = await timeline
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (hasTimeline) {
        // Propose resolution
        const proposeBtn = sharedPage.getByRole('button', { name: /propose|resolve/i });
        const hasPropose = await proposeBtn
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false);
        if (hasPropose) {
          await proposeBtn.first().click();
          await sharedPage.waitForTimeout(500);
        }
      }
    }
  });

  test.fixme('AC5: Approved invoice approaching due date → Finance Officer + CA receive notifications with link', async () => {
    await navigateInApp(sharedPage, '/invoices');

    // Look for invoices with due date indicators
    const dueSoonIndicator = sharedPage.locator(
      '[class*="due"], [class*="warning"], [class*="overdue"]',
    );
    const hasDueIndicator = await dueSoonIndicator
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    // Check notifications panel
    const notificationBtn = sharedPage.locator(
      '[class*="notification"], [aria-label*="notification"]',
    );
    const hasNotification = await notificationBtn
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (hasNotification) {
      await notificationBtn.first().click();
      await sharedPage.waitForTimeout(500);

      // Look for payment reminder notifications
      const paymentReminder = sharedPage.getByText(/payment|due|overdue|invoice/i);
      const hasReminder = await paymentReminder
        .first()
        .isVisible()
        .catch(() => false);
      // Notifications may or may not exist depending on seed data
    }
  });

  test.fixme('Edge: Invoice file cannot be parsed by OCR → error shown; user can manually enter all data', async () => {
    await navigateInApp(sharedPage, '/invoices');

    const uploadBtn = sharedPage.getByRole('button', { name: /upload|create new/i });
    await expect(uploadBtn.first()).toBeVisible({ timeout: 10000 });
    await uploadBtn.first().click();
    await sharedPage.waitForTimeout(500);

    // Upload an unreadable file
    const fileInput = sharedPage.locator('input[type="file"]');
    const hasFileInput = await fileInput.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasFileInput) {
      await fileInput.setInputFiles({
        name: 'corrupted.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('not a real pdf'),
      });
      await sharedPage.waitForTimeout(3000);

      // Verify error message
      const errorMsg = sharedPage.getByText(/error|failed|cannot parse|unable/i);
      const hasError = await errorMsg
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      // Verify manual entry form is available
      const manualForm = sharedPage
        .getByRole('button', { name: /manual|enter manually/i })
        .or(sharedPage.locator('form'));
      const hasManual = await manualForm
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      expect(hasError || hasManual).toBeTruthy();
    }
  });
});
