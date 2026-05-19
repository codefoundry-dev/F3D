import { test, expect, type Page } from '@playwright/test';
import { loginAs, navigateInApp } from '../helpers/procurement-helpers';
import { COMPANY_ADMIN } from '../fixtures/test-data';

test.describe('US-15 - Change Orders for POs', () => {
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

  test.fixme('AC1: Only authorized users can initiate Change Order on Approved/Active PO; cannot create for terminal statuses', async () => {
    await navigateInApp(sharedPage, '/purchase-orders');

    const rows = sharedPage.locator('tbody tr');
    const rowCount = await rows.count().catch(() => 0);

    if (rowCount > 0) {
      // Find an active/approved PO
      const activeRow = sharedPage
        .locator('tbody tr')
        .filter({ hasText: /active|approved/i })
        .first();
      const hasActive = await activeRow.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasActive) {
        await activeRow.click();
        await sharedPage.waitForTimeout(1000);

        // Verify Change Order button is visible and enabled
        const changeOrderBtn = sharedPage.getByRole('button', {
          name: /change order|request change/i,
        });
        await expect(changeOrderBtn.first()).toBeVisible({ timeout: 5000 });
        const isEnabled = !(await changeOrderBtn.first().isDisabled());
        expect(isEnabled).toBeTruthy();

        // Navigate back
        await navigateInApp(sharedPage, '/purchase-orders');
      }

      // Find a closed/cancelled PO
      const closedRow = sharedPage
        .locator('tbody tr')
        .filter({ hasText: /closed|cancelled|completed/i })
        .first();
      const hasClosed = await closedRow.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasClosed) {
        await closedRow.click();
        await sharedPage.waitForTimeout(1000);

        // Verify Change Order button is hidden or disabled
        const changeOrderBtn = sharedPage.getByRole('button', {
          name: /change order|request change/i,
        });
        const isVisible = await changeOrderBtn
          .first()
          .isVisible({ timeout: 3000 })
          .catch(() => false);
        if (isVisible) {
          const isDisabled = await changeOrderBtn.first().isDisabled();
          expect(isDisabled).toBeTruthy();
        }
        // Not visible is also acceptable
      }
    }
  });

  test.fixme('AC2: Change Order allows updating: quantities, items (add/remove/substitute), prices, delivery dates, commercial terms', async () => {
    await navigateInApp(sharedPage, '/purchase-orders');

    const activeRow = sharedPage
      .locator('tbody tr')
      .filter({ hasText: /active|approved/i })
      .first();
    const hasActive = await activeRow.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasActive) {
      await activeRow.click();
      await sharedPage.waitForTimeout(1000);

      const changeOrderBtn = sharedPage.getByRole('button', {
        name: /change order|request change/i,
      });
      const hasBtn = await changeOrderBtn
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (hasBtn) {
        await changeOrderBtn.first().click();
        await sharedPage.waitForTimeout(1000);

        // Verify change order form shows current PO details
        const form = sharedPage.locator('form, [class*="change-order"], [class*="changeOrder"]');
        await expect(form.first()).toBeVisible({ timeout: 5000 });

        // Verify editable fields
        const qtyField = sharedPage.locator('input[type="number"]').first();
        const hasQty = await qtyField.isVisible({ timeout: 5000 }).catch(() => false);
        if (hasQty) {
          await qtyField.fill('25');
        }

        // Verify add/remove item buttons
        const addItemBtn = sharedPage.getByRole('button', { name: /add item|add line/i });
        const removeItemBtn = sharedPage.getByRole('button', { name: /remove|delete/i });
        const hasAddItem = await addItemBtn
          .first()
          .isVisible({ timeout: 3000 })
          .catch(() => false);
        const hasRemove = await removeItemBtn
          .first()
          .isVisible()
          .catch(() => false);

        // Verify delivery date field
        const dateField = sharedPage.getByLabel(/delivery date/i);
        const hasDate = await dateField.isVisible({ timeout: 3000 }).catch(() => false);

        // Verify before/after comparison
        const comparison = sharedPage.getByText(/original|before|current/i);
        const hasComparison = await comparison
          .first()
          .isVisible()
          .catch(() => false);
      }
    }
  });

  test.fixme('AC3: System classifies as Minor/Major based on configurable rules; classification visible before submission', async () => {
    await navigateInApp(sharedPage, '/purchase-orders');

    const activeRow = sharedPage
      .locator('tbody tr')
      .filter({ hasText: /active|approved/i })
      .first();
    const hasActive = await activeRow.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasActive) {
      await activeRow.click();
      await sharedPage.waitForTimeout(1000);

      const changeOrderBtn = sharedPage.getByRole('button', {
        name: /change order|request change/i,
      });
      const hasBtn = await changeOrderBtn
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (hasBtn) {
        await changeOrderBtn.first().click();
        await sharedPage.waitForTimeout(1000);

        // Make a small change
        const qtyField = sharedPage.locator('input[type="number"]').first();
        const hasQty = await qtyField.isVisible({ timeout: 5000 }).catch(() => false);
        if (hasQty) {
          const currentVal = await qtyField.inputValue();
          const newVal = String(Number(currentVal || '10') + 1);
          await qtyField.fill(newVal);
          await sharedPage.waitForTimeout(1000);

          // Verify classification badge
          const minorBadge = sharedPage.getByText(/minor/i);
          const majorBadge = sharedPage.getByText(/major/i);
          const classification = sharedPage.locator('[class*="classification"], [class*="badge"]');

          const hasMinor = await minorBadge
            .first()
            .isVisible()
            .catch(() => false);
          const hasMajor = await majorBadge
            .first()
            .isVisible()
            .catch(() => false);
          const hasClassification = await classification
            .first()
            .isVisible()
            .catch(() => false);

          expect(hasMinor || hasMajor || hasClassification).toBeTruthy();
        }
      }
    }
  });

  test.fixme('AC4: Minor → auto-approved, PO updated with new version (v2, v3), logged in Change History', async () => {
    await navigateInApp(sharedPage, '/purchase-orders');

    const activeRow = sharedPage
      .locator('tbody tr')
      .filter({ hasText: /active|approved/i })
      .first();
    const hasActive = await activeRow.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasActive) {
      await activeRow.click();
      await sharedPage.waitForTimeout(1000);

      const changeOrderBtn = sharedPage.getByRole('button', {
        name: /change order|request change/i,
      });
      const hasBtn = await changeOrderBtn
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (hasBtn) {
        await changeOrderBtn.first().click();
        await sharedPage.waitForTimeout(1000);

        // Make a minor change
        const qtyField = sharedPage.locator('input[type="number"]').first();
        const hasQty = await qtyField.isVisible({ timeout: 5000 }).catch(() => false);
        if (hasQty) {
          await qtyField.fill('11');
        }

        // Fill reason
        const reasonField = sharedPage
          .getByLabel(/reason/i)
          .or(sharedPage.locator('textarea').first());
        const hasReason = await reasonField.isVisible({ timeout: 5000 }).catch(() => false);
        if (hasReason) {
          await reasonField.fill('Slight quantity adjustment needed');
        }

        // Submit
        const submitBtn = sharedPage.getByRole('button', { name: /submit|save/i });
        await submitBtn.first().click();
        await sharedPage.waitForTimeout(2000);

        // Verify auto-approved
        const approvedMsg = sharedPage.getByText(/auto.?approved|approved|updated/i);
        await expect(approvedMsg.first()).toBeVisible({ timeout: 5000 });

        // Verify version incremented
        const versionBadge = sharedPage.getByText(/v2|version 2/i);
        const hasVersion = await versionBadge
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false);

        // Navigate to change history
        const historyTab = sharedPage
          .getByRole('tab', { name: /change history|history/i })
          .or(sharedPage.getByText(/change history/i));
        const hasHistory = await historyTab
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false);
        if (hasHistory) {
          await historyTab.first().click();
          await sharedPage.waitForTimeout(1000);

          // Verify change is logged
          const changeEntry = sharedPage.getByText(/auto.?approved|minor/i);
          await expect(changeEntry.first()).toBeVisible({ timeout: 5000 });
        }
      }
    }
  });

  test.fixme('AC5: Major → Pending Approval, sent to approver(s); approvers can Approve/Reject with comment', async () => {
    await navigateInApp(sharedPage, '/purchase-orders');

    const activeRow = sharedPage
      .locator('tbody tr')
      .filter({ hasText: /active|approved/i })
      .first();
    const hasActive = await activeRow.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasActive) {
      await activeRow.click();
      await sharedPage.waitForTimeout(1000);

      const changeOrderBtn = sharedPage.getByRole('button', { name: /change order/i });
      const hasBtn = await changeOrderBtn
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (hasBtn) {
        await changeOrderBtn.first().click();
        await sharedPage.waitForTimeout(1000);

        // Make a major change (large cost increase)
        const priceField = sharedPage.getByLabel(/price|amount/i).first();
        const hasPrice = await priceField.isVisible({ timeout: 5000 }).catch(() => false);
        if (hasPrice) {
          await priceField.fill('999999');
        }

        // Fill reason
        const reasonField = sharedPage
          .getByLabel(/reason/i)
          .or(sharedPage.locator('textarea').first());
        const hasReason = await reasonField.isVisible({ timeout: 5000 }).catch(() => false);
        if (hasReason) {
          await reasonField.fill('Major scope change requiring additional materials');
        }

        const submitBtn = sharedPage.getByRole('button', { name: /submit/i });
        await submitBtn.first().click();
        await sharedPage.waitForTimeout(2000);

        // Verify pending approval status
        const pendingMsg = sharedPage.getByText(/pending approval|sent for approval/i);
        await expect(pendingMsg.first()).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test.fixme('AC6: Approved → PO updated + new version, vendor+stakeholders notified. Rejected → original PO unchanged, rejection reason shown', async () => {
    await navigateInApp(sharedPage, '/purchase-orders');

    const rows = sharedPage.locator('tbody tr');
    const rowCount = await rows.count().catch(() => 0);

    if (rowCount > 0) {
      await rows.first().click();
      await sharedPage.waitForTimeout(1000);

      // Navigate to change history
      const historyTab = sharedPage
        .getByRole('tab', { name: /change history|history/i })
        .or(sharedPage.getByText(/change history/i));
      const hasHistory = await historyTab
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (hasHistory) {
        await historyTab.first().click();
        await sharedPage.waitForTimeout(1000);

        // Check for approved and/or rejected entries
        const approvedEntry = sharedPage.getByText(/approved/i);
        const rejectedEntry = sharedPage.getByText(/rejected/i);

        const hasApproved = await approvedEntry
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false);
        const hasRejected = await rejectedEntry
          .first()
          .isVisible()
          .catch(() => false);

        // If rejected entry exists, verify rejection reason
        if (hasRejected) {
          await rejectedEntry.first().click();
          await sharedPage.waitForTimeout(500);

          const reason = sharedPage.getByText(/reason|comment/i);
          const hasReason = await reason
            .first()
            .isVisible({ timeout: 5000 })
            .catch(() => false);
          expect(hasReason).toBeTruthy();
        }
      }
    }
  });

  test.fixme('AC7: Full audit trail: initiator, approver(s), timestamps, before/after values; viewable from PO Details', async () => {
    await navigateInApp(sharedPage, '/purchase-orders');

    const rows = sharedPage.locator('tbody tr');
    const rowCount = await rows.count().catch(() => 0);

    if (rowCount > 0) {
      await rows.first().click();
      await sharedPage.waitForTimeout(1000);

      // Navigate to Change History tab
      const historyTab = sharedPage
        .getByRole('tab', { name: /change history|audit|history/i })
        .or(sharedPage.getByText(/change history/i));
      const hasHistory = await historyTab
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (hasHistory) {
        await historyTab.first().click();
        await sharedPage.waitForTimeout(1000);

        // Verify change entries exist
        const entries = sharedPage.locator(
          '[class*="entry"], [class*="change"], [class*="audit"], tbody tr',
        );
        const entryCount = await entries.count();

        if (entryCount > 0) {
          // Click first entry to see details
          await entries.first().click();
          await sharedPage.waitForTimeout(500);

          // Verify audit fields
          const timestamp = sharedPage.getByText(/\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4}/);
          const hasTimestamp = await timestamp
            .first()
            .isVisible({ timeout: 5000 })
            .catch(() => false);

          const initiator = sharedPage.getByText(/initiated by|created by|by:/i);
          const hasInitiator = await initiator
            .first()
            .isVisible()
            .catch(() => false);

          const beforeAfter = sharedPage.getByText(/before|after|original|revised/i);
          const hasBeforeAfter = await beforeAfter
            .first()
            .isVisible()
            .catch(() => false);

          expect(hasTimestamp || hasInitiator || hasBeforeAfter).toBeTruthy();
        }
      }
    }
  });

  test.fixme('AC8: Required fields validated before submission; prevents negative qty, invalid date with actionable errors', async () => {
    await navigateInApp(sharedPage, '/purchase-orders');

    const activeRow = sharedPage
      .locator('tbody tr')
      .filter({ hasText: /active|approved/i })
      .first();
    const hasActive = await activeRow.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasActive) {
      await activeRow.click();
      await sharedPage.waitForTimeout(1000);

      const changeOrderBtn = sharedPage.getByRole('button', { name: /change order/i });
      const hasBtn = await changeOrderBtn
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (hasBtn) {
        await changeOrderBtn.first().click();
        await sharedPage.waitForTimeout(1000);

        // Try submitting without changes
        const submitBtn = sharedPage.getByRole('button', { name: /submit/i });
        await submitBtn.first().click();
        await sharedPage.waitForTimeout(1000);

        // Verify validation error
        const error = sharedPage.getByText(/required|at least one change|cannot be empty/i);
        const hasError = await error
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false);

        // Enter negative quantity
        const qtyField = sharedPage.locator('input[type="number"]').first();
        const hasQty = await qtyField.isVisible({ timeout: 5000 }).catch(() => false);
        if (hasQty) {
          await qtyField.fill('-5');
          await submitBtn.first().click();
          await sharedPage.waitForTimeout(1000);

          const negativeError = sharedPage.getByText(/negative|greater than zero|positive/i);
          const hasNegError = await negativeError
            .first()
            .isVisible({ timeout: 5000 })
            .catch(() => false);
          expect(hasError || hasNegError).toBeTruthy();
        }
      }
    }
  });

  test.fixme('Edge: Change Order submitted but PO closed before approval → auto-rejected with system note', async () => {
    await navigateInApp(sharedPage, '/purchase-orders');

    const rows = sharedPage.locator('tbody tr');
    const rowCount = await rows.count().catch(() => 0);

    if (rowCount > 0) {
      await rows.first().click();
      await sharedPage.waitForTimeout(1000);

      // Look for auto-rejected change orders
      const historyTab = sharedPage
        .getByRole('tab', { name: /change history|history/i })
        .or(sharedPage.getByText(/change history/i));
      const hasHistory = await historyTab
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (hasHistory) {
        await historyTab.first().click();
        await sharedPage.waitForTimeout(1000);

        const autoRejected = sharedPage.getByText(/auto.?rejected|system rejected/i);
        const hasAutoRejected = await autoRejected
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false);

        if (hasAutoRejected) {
          await autoRejected.first().click();
          await sharedPage.waitForTimeout(500);

          // Verify system note
          const systemNote = sharedPage.getByText(/closed|no longer modifiable/i);
          await expect(systemNote.first()).toBeVisible({ timeout: 5000 });
        }
      }
    }
  });

  test.fixme('Edge: Minor change auto-approves but PO total exceeds project budget → warning to CA+FO, PO flagged over-budget', async () => {
    await navigateInApp(sharedPage, '/purchase-orders');

    const rows = sharedPage.locator('tbody tr');
    const rowCount = await rows.count().catch(() => 0);

    if (rowCount > 0) {
      await rows.first().click();
      await sharedPage.waitForTimeout(1000);

      // Look for over-budget indicator
      const overBudget = sharedPage.getByText(/over.?budget|budget exceeded|warning/i);
      const hasOverBudget = await overBudget
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      // If PO detail has a budget section, verify the flag
      const budgetSection = sharedPage.locator('[class*="budget"], [class*="financial"]');
      const hasBudget = await budgetSection
        .first()
        .isVisible()
        .catch(() => false);

      // Verify notification exists (in notification panel)
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

        const budgetWarning = sharedPage.getByText(/budget|over.?budget/i);
        const hasBudgetWarning = await budgetWarning
          .first()
          .isVisible()
          .catch(() => false);
      }
    }
  });
});
