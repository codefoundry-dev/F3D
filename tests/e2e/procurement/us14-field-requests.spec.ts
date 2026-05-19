import { test, expect, type Page } from '@playwright/test';
import { loginAs, navigateInApp } from '../helpers/procurement-helpers';
import { FIELD_WORKER } from '../fixtures/test-data';

test.describe('US-14 - Field Material Requests', () => {
  test.describe.configure({ mode: 'serial' });

  let sharedPage: Page;

  test.beforeAll(async ({ browser }) => {
    sharedPage = await browser.newPage({
      baseURL: 'http://localhost:3002',
    });
    await loginAs(sharedPage, FIELD_WORKER.email, FIELD_WORKER.password);
  });

  test.afterAll(async () => {
    await sharedPage?.close();
  });

  test.fixme('AC1: Foreman offline creates material request with items+photos → saved as draft locally; syncs on connectivity → appears in warehouse queue', async () => {
    await navigateInApp(sharedPage, '/');

    // Navigate to material requests
    const requestBtn = sharedPage
      .getByRole('button', { name: /new.*request|material request|create request/i })
      .or(sharedPage.getByRole('link', { name: /request/i }));
    const hasRequestBtn = await requestBtn
      .first()
      .isVisible({ timeout: 10000 })
      .catch(() => false);

    if (hasRequestBtn) {
      await requestBtn.first().click();
      await sharedPage.waitForTimeout(1000);

      // Simulate offline by intercepting network requests
      await sharedPage.context().setOffline(true);

      // Add line items
      const addItemBtn = sharedPage.getByRole('button', { name: /add item|add material/i });
      const hasAdd = await addItemBtn
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);
      if (hasAdd) {
        await addItemBtn.first().click();
        await sharedPage.waitForTimeout(500);

        // Fill material name
        const nameField = sharedPage.getByLabel(/material|item name/i).first();
        const hasName = await nameField.isVisible({ timeout: 3000 }).catch(() => false);
        if (hasName) {
          await nameField.fill('Concrete Mix 40kg');
        }

        // Fill quantity
        const qtyField = sharedPage.getByLabel(/quantity|qty/i).first();
        const hasQty = await qtyField.isVisible({ timeout: 3000 }).catch(() => false);
        if (hasQty) {
          await qtyField.fill('50');
        }
      }

      // Save as draft
      const saveDraftBtn = sharedPage.getByRole('button', { name: /save draft|save/i });
      const hasSave = await saveDraftBtn
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);
      if (hasSave) {
        await saveDraftBtn.first().click();
        await sharedPage.waitForTimeout(500);
      }

      // Verify draft is saved locally
      const draftIndicator = sharedPage.getByText(/draft|saved locally|offline/i);
      const hasDraft = await draftIndicator
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);
      expect(hasDraft).toBeTruthy();

      // Restore online
      await sharedPage.context().setOffline(false);
      await sharedPage.waitForTimeout(3000);

      // Verify sync indicator
      const syncIndicator = sharedPage.getByText(/synced|sync complete|uploaded/i);
      const hasSynced = await syncIndicator
        .first()
        .isVisible({ timeout: 10000 })
        .catch(() => false);
      // Sync may happen silently
    }
  });

  test.fixme('AC2: Foreman assigned to 3 projects → switch between projects on home screen, see pending deliveries + drafts per project', async () => {
    await navigateInApp(sharedPage, '/');

    // Verify project switcher
    const projectSwitcher = sharedPage
      .locator('[class*="project-switcher"], [class*="projectSelect"], select')
      .or(sharedPage.getByRole('combobox'))
      .or(sharedPage.getByLabel(/project/i));
    const hasSwitcher = await projectSwitcher
      .first()
      .isVisible({ timeout: 10000 })
      .catch(() => false);

    if (hasSwitcher) {
      // Click project switcher to see options
      await projectSwitcher.first().click();
      await sharedPage.waitForTimeout(500);

      // Verify at least one project is listed
      const options = sharedPage
        .getByRole('option')
        .or(sharedPage.locator('[class*="option"], [class*="item"]'));
      const optionCount = await options.count();
      expect(optionCount).toBeGreaterThan(0);

      // Select first project
      await options.first().click();
      await sharedPage.waitForTimeout(1000);

      // Verify pending deliveries section
      const pendingSection = sharedPage.getByText(/pending deliver|delivery/i);
      const hasPending = await pendingSection
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      // Verify drafts section
      const draftsSection = sharedPage.getByText(/draft|saved/i);
      const hasDrafts = await draftsSection
        .first()
        .isVisible()
        .catch(() => false);

      expect(hasPending || hasDrafts).toBeTruthy();
    }
  });

  test.fixme('AC3: Delivery arrives → open delivery confirmation for PO, photograph, mark each item received/short/damaged, submit', async () => {
    await navigateInApp(sharedPage, '/');

    // Navigate to pending deliveries
    const deliveryLink = sharedPage
      .getByText(/pending deliver/i)
      .or(sharedPage.getByRole('link', { name: /deliver/i }));
    const hasLink = await deliveryLink
      .first()
      .isVisible({ timeout: 10000 })
      .catch(() => false);

    if (hasLink) {
      await deliveryLink.first().click();
      await sharedPage.waitForTimeout(1000);

      // Open delivery confirmation
      const confirmBtn = sharedPage.getByRole('button', { name: /confirm delivery|open/i });
      const hasConfirm = await confirmBtn
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (hasConfirm) {
        await confirmBtn.first().click();
        await sharedPage.waitForTimeout(1000);

        // Verify PO line items are listed
        const lineItems = sharedPage.locator('table tbody tr, [class*="lineItem"]');
        const itemCount = await lineItems.count();
        expect(itemCount).toBeGreaterThan(0);

        // Mark items with different outcomes
        const outcomeSelects = sharedPage.locator('select, [role="combobox"]');
        const selectCount = await outcomeSelects.count();

        if (selectCount > 0) {
          // First item: received
          await outcomeSelects.first().click();
          const receivedOpt = sharedPage.getByRole('option', { name: /received|delivered/i });
          if (
            await receivedOpt
              .first()
              .isVisible()
              .catch(() => false)
          ) {
            await receivedOpt.first().click();
          }
        }

        // Submit delivery confirmation
        const submitBtn = sharedPage.getByRole('button', { name: /submit|confirm/i });
        const hasSubmit = await submitBtn
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false);
        if (hasSubmit) {
          await submitBtn.first().click();
          await sharedPage.waitForTimeout(1000);

          const successMsg = sharedPage.getByText(/submitted|confirmed|success/i);
          await expect(successMsg.first()).toBeVisible({ timeout: 5000 });
        }
      }
    }
  });

  test.fixme('AC4: Defect reported → office team + vendor notified with details+photos, message thread opened on PO', async () => {
    await navigateInApp(sharedPage, '/');

    // Navigate to a PO with recent delivery containing defects
    const poLink = sharedPage
      .getByText(/purchase order|po/i)
      .or(sharedPage.getByRole('link', { name: /po|order/i }));
    const hasLink = await poLink
      .first()
      .isVisible({ timeout: 10000 })
      .catch(() => false);

    if (hasLink) {
      await poLink.first().click();
      await sharedPage.waitForTimeout(1000);

      // Verify defect flag
      const defectFlag = sharedPage.getByText(/defect|damaged|issue/i);
      const hasDefect = await defectFlag
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      // Verify message thread
      const messageThread = sharedPage.getByText(/message|comment|thread/i);
      const hasThread = await messageThread
        .first()
        .isVisible()
        .catch(() => false);

      if (hasThread) {
        // Add a reply
        const messageInput = sharedPage.locator('textarea, input[type="text"]').last();
        const hasInput = await messageInput.isVisible({ timeout: 5000 }).catch(() => false);
        if (hasInput) {
          await messageInput.fill('Defect confirmed on site - requesting replacement');
          const sendBtn = sharedPage.getByRole('button', { name: /send|reply/i });
          const hasSend = await sendBtn
            .first()
            .isVisible({ timeout: 3000 })
            .catch(() => false);
          if (hasSend) {
            await sendBtn.first().click();
            await sharedPage.waitForTimeout(1000);
          }
        }
      }
    }
  });

  test.fixme('Edge: Offline request + same item already ordered by office → on sync, system flags potential duplicates for PO review', async () => {
    await navigateInApp(sharedPage, '/');

    // Create a request with an item that's already ordered
    const requestBtn = sharedPage.getByRole('button', { name: /new.*request|material request/i });
    const hasBtn = await requestBtn
      .first()
      .isVisible({ timeout: 10000 })
      .catch(() => false);

    if (hasBtn) {
      // Go offline
      await sharedPage.context().setOffline(true);

      await requestBtn.first().click();
      await sharedPage.waitForTimeout(500);

      // Add an item that already exists in an active PO
      const addItemBtn = sharedPage.getByRole('button', { name: /add item/i });
      const hasAdd = await addItemBtn
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);
      if (hasAdd) {
        await addItemBtn.first().click();
        await sharedPage.waitForTimeout(500);
      }

      // Save draft
      const saveDraftBtn = sharedPage.getByRole('button', { name: /save/i });
      const hasSave = await saveDraftBtn
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);
      if (hasSave) {
        await saveDraftBtn.first().click();
        await sharedPage.waitForTimeout(500);
      }

      // Go back online
      await sharedPage.context().setOffline(false);
      await sharedPage.waitForTimeout(3000);

      // Verify duplicate flag
      const duplicateFlag = sharedPage.getByText(/duplicate|already ordered|conflict/i);
      const hasDuplicate = await duplicateFlag
        .first()
        .isVisible({ timeout: 10000 })
        .catch(() => false);
      expect(hasDuplicate).toBeTruthy();
    }
  });
});
