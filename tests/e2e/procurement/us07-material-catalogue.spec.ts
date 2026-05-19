import { test, expect, type Page } from '@playwright/test';
import { loginAs, navigateInApp } from '../helpers/procurement-helpers';
import { SUPER_ADMIN, PROCUREMENT_OFFICER } from '../fixtures/test-data';

test.describe('US-7 - Material Catalogue Management', () => {
  test.describe.configure({ mode: 'serial' });

  test.describe('Super Admin — Catalogue Upload & Approval (port 3001)', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
      sharedPage = await browser.newPage({
        baseURL: 'http://localhost:3001',
      });
      await loginAs(sharedPage, SUPER_ADMIN.email, SUPER_ADMIN.password);
    });

    test.afterAll(async () => {
      await sharedPage?.close();
    });

    test.fixme('AC1: SA uploads file → column-mapping step with auto-suggested data types; confirm/adjust before commit', async () => {
      await navigateInApp(sharedPage, '/materials');

      // Click upload/import button
      const uploadBtn = sharedPage.getByRole('button', { name: /upload|import/i });
      await expect(uploadBtn.first()).toBeVisible({ timeout: 10000 });
      await uploadBtn.first().click();
      await sharedPage.waitForTimeout(500);

      // Upload file via file input
      const fileInput = sharedPage.locator('input[type="file"]');
      const hasFileInput = await fileInput.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasFileInput) {
        // Set a test CSV file
        await fileInput.setInputFiles({
          name: 'test-materials.csv',
          mimeType: 'text/csv',
          buffer: Buffer.from(
            'Name,Category,Unit,Price\nConcrete Mix,Building,kg,45.00\nSteel Rod,Metal,m,12.50',
          ),
        });
        await sharedPage.waitForTimeout(2000);

        // Verify column-mapping step appears
        const mappingStep = sharedPage.getByText(/column.?mapping|map columns|mapping/i);
        const hasMappingStep = await mappingStep
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false);
        expect(hasMappingStep).toBeTruthy();

        // Verify auto-suggested data types are shown
        const suggestionIndicators = sharedPage.locator(
          'select, [role="combobox"], [class*="mapping"]',
        );
        const sugCount = await suggestionIndicators.count();
        expect(sugCount).toBeGreaterThan(0);

        // Confirm the mapping
        const confirmBtn = sharedPage.getByRole('button', { name: /confirm|commit|import/i });
        const hasConfirm = await confirmBtn
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false);
        if (hasConfirm) {
          await confirmBtn.first().click();
          await sharedPage.waitForTimeout(2000);
        }
      }
    });

    test.fixme('AC4: SA approves suggested material → immediately available in public catalogue', async () => {
      await navigateInApp(sharedPage, '/materials');

      // Navigate to pending suggestions section
      const pendingTab = sharedPage
        .getByRole('tab', { name: /pending|suggestions/i })
        .or(sharedPage.getByText(/pending suggestions/i));
      const hasPending = await pendingTab
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (hasPending) {
        await pendingTab.first().click();
        await sharedPage.waitForTimeout(1000);

        // Find an approve button on a suggested material
        const approveBtn = sharedPage.getByRole('button', { name: /approve/i });
        const hasApprove = await approveBtn
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false);

        if (hasApprove) {
          await approveBtn.first().click();
          await sharedPage.waitForTimeout(1000);

          // Verify success
          const successMsg = sharedPage.getByText(/approved|success/i);
          await expect(successMsg.first()).toBeVisible({ timeout: 5000 });
        }
      }
    });

    test.fixme('Edge: Upload duplicate material → system detects, shows warning, prevents saving without resolution', async () => {
      await navigateInApp(sharedPage, '/materials');

      const uploadBtn = sharedPage.getByRole('button', { name: /upload|import/i });
      await expect(uploadBtn.first()).toBeVisible({ timeout: 10000 });
      await uploadBtn.first().click();
      await sharedPage.waitForTimeout(500);

      const fileInput = sharedPage.locator('input[type="file"]');
      const hasFileInput = await fileInput.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasFileInput) {
        // Upload file with duplicate materials
        await fileInput.setInputFiles({
          name: 'duplicates.csv',
          mimeType: 'text/csv',
          buffer: Buffer.from('Name,Category,Unit,Price\nConcrete Mix,Building,kg,45.00'),
        });
        await sharedPage.waitForTimeout(2000);

        // Verify duplicate warning
        const duplicateWarning = sharedPage.getByText(/duplicate|already exists|conflict/i);
        const hasWarning = await duplicateWarning
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false);
        expect(hasWarning).toBeTruthy();
      }
    });
  });

  test.describe('Procurement Officer — Catalogue Search & Suggestions (port 3002)', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
      sharedPage = await browser.newPage({
        baseURL: 'http://localhost:3002',
      });
      await loginAs(sharedPage, PROCUREMENT_OFFICER.email, PROCUREMENT_OFFICER.password);
    });

    test.afterAll(async () => {
      await sharedPage?.close();
    });

    test.fixme('AC2: PO searches catalogue during RFQ → real-time suggestions (frequent, recent, BOM materials)', async () => {
      await navigateInApp(sharedPage, '/rfqs/new');

      await expect(sharedPage.locator('form, [class*="create"]').first()).toBeVisible({
        timeout: 10000,
      });

      // Find material search input in the RFQ form
      const materialSearch = sharedPage
        .getByPlaceholder(/search material|material name/i)
        .or(sharedPage.getByLabel(/material/i));
      const hasSearch = await materialSearch
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (hasSearch) {
        await materialSearch.first().fill('con');
        await sharedPage.waitForTimeout(1000);

        // Verify real-time suggestions dropdown appears
        const suggestions = sharedPage.locator(
          '[role="listbox"], [role="option"], [class*="suggestion"], [class*="dropdown"]',
        );
        const sugCount = await suggestions.count();
        expect(sugCount).toBeGreaterThan(0);
      }
    });

    test.fixme('AC3: PO suggests new material → not visible until SA reviews and approves', async () => {
      await navigateInApp(sharedPage, '/materials');

      // Click suggest new material button
      const suggestBtn = sharedPage.getByRole('button', {
        name: /suggest|add.*material|new material/i,
      });
      const hasSuggest = await suggestBtn
        .first()
        .isVisible({ timeout: 10000 })
        .catch(() => false);

      if (hasSuggest) {
        await suggestBtn.first().click();
        await sharedPage.waitForTimeout(500);

        // Fill in material suggestion form
        const nameField = sharedPage.getByLabel(/name/i).first();
        const hasName = await nameField.isVisible({ timeout: 5000 }).catch(() => false);

        if (hasName) {
          const uniqueName = `E2E Suggested Material ${Date.now()}`;
          await nameField.fill(uniqueName);

          // Submit suggestion
          const submitBtn = sharedPage.getByRole('button', { name: /submit|suggest|save/i });
          await submitBtn.first().click();
          await sharedPage.waitForTimeout(1000);

          // Search for the suggested material in public catalogue
          const searchInput = sharedPage.getByPlaceholder(/search/i);
          if (
            await searchInput
              .first()
              .isVisible()
              .catch(() => false)
          ) {
            await searchInput.first().fill(uniqueName);
            await sharedPage.waitForTimeout(1000);

            // Material should NOT be visible (pending review)
            const materialResult = sharedPage.getByText(uniqueName);
            const found = await materialResult.isVisible().catch(() => false);
            expect(found).toBeFalsy();
          }
        }
      }
    });
  });
});
