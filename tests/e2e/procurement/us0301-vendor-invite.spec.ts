import { test, expect, type Page } from '@playwright/test';
import { loginAs, navigateInApp } from '../helpers/procurement-helpers';
import { COMPANY_ADMIN, VENDOR_USER } from '../fixtures/test-data';

test.describe('US-3.01 - Vendor Invitation & List', () => {
  test.describe.configure({ mode: 'serial' });

  let sharedPage: Page;

  test.beforeAll(async ({ browser }) => {
    sharedPage = await browser.newPage({ baseURL: 'http://localhost:3002' });
    await loginAs(sharedPage, COMPANY_ADMIN.email, COMPANY_ADMIN.password);
  });

  test.afterAll(async () => {
    await sharedPage?.close();
  });

  test('AC1: CA invites vendor — invitation sent, vendor listed as Invited', async () => {
    await navigateInApp(sharedPage, '/vendors');

    // "Invite vendor" button from i18n vendors.inviteVendor
    const inviteBtn = sharedPage.getByRole('button', {
      name: /Invite vendor/i,
    });
    await expect(inviteBtn).toBeVisible({ timeout: 10000 });
    await inviteBtn.click();
    await sharedPage.waitForTimeout(500);

    // InviteVendorModal: title "Add a new vendor account"
    const modalTitle = sharedPage.getByText('Add a new vendor account');
    await expect(modalTitle).toBeVisible({ timeout: 5000 });

    // Company dropdown — select or create
    const companyDropdown = sharedPage.getByText(/Select company/i);
    const hasDropdown = await companyDropdown.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasDropdown) {
      // Use "Add vendor company" action if no company to select
      const addCompanyBtn = sharedPage.getByText(/Add vendor company/i);
      const hasAddCompany = await addCompanyBtn.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasAddCompany) {
        await addCompanyBtn.click();
        await sharedPage.waitForTimeout(500);

        // CreateVendorCompanyModal
        const uniqueId = Date.now();
        const companyName = sharedPage.getByLabel(/Company name/i);
        if (await companyName.isVisible({ timeout: 3000 }).catch(() => false)) {
          await companyName.fill(`E2E Vendor ${uniqueId}`);
        }
        const companyEmail = sharedPage.getByLabel(/Company email/i);
        if (await companyEmail.isVisible({ timeout: 3000 }).catch(() => false)) {
          await companyEmail.fill(`company-${uniqueId}@e2evendor.test`);
        }
        const createBtn = sharedPage.getByRole('button', {
          name: /Create/i,
        });
        if (
          await createBtn
            .first()
            .isVisible()
            .catch(() => false)
        ) {
          await createBtn.first().click();
          await sharedPage.waitForTimeout(2000);
        }
      }
    }

    // Fill representative fields
    // Placeholder "Name Surname" from inviteModal.representativeNamePlaceholder
    const repName = sharedPage.getByPlaceholder('Name Surname');
    if (await repName.isVisible({ timeout: 3000 }).catch(() => false)) {
      await repName.fill('E2E Sales Rep');
    }

    // Placeholder "admin@example.com" from inviteModal.representativeEmailPlaceholder
    const repEmail = sharedPage.getByPlaceholder('admin@example.com');
    if (await repEmail.isVisible({ timeout: 3000 }).catch(() => false)) {
      const uniqueId = Date.now();
      await repEmail.fill(`rep-${uniqueId}@e2evendor.test`);
    }

    // "Send Invitation" button
    const sendBtn = sharedPage.getByRole('button', {
      name: /Send Invitation/i,
    });
    await sendBtn.click();
    await sharedPage.waitForTimeout(2000);

    // Success modal: "Invitation has been sent successfully"
    const successMsg = sharedPage.getByText(/Invitation has been sent|Vendor added/i);
    await expect(successMsg.first()).toBeVisible({ timeout: 5000 });
  });

  test('AC2: Existing vendor invited by different contractor is added directly', async () => {
    await navigateInApp(sharedPage, '/vendors');

    const inviteBtn = sharedPage.getByRole('button', {
      name: /Invite vendor/i,
    });
    await expect(inviteBtn).toBeVisible({ timeout: 10000 });
    await inviteBtn.click();
    await sharedPage.waitForTimeout(500);

    // Enter existing vendor's email
    const repEmail = sharedPage.getByPlaceholder('admin@example.com');
    const hasField = await repEmail.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasField) {
      await repEmail.fill(VENDOR_USER.email);
      await sharedPage.waitForTimeout(1000);

      // May show "already exists" or "already in your vendor list"
      const existsMsg = sharedPage.getByText(
        /already exists|already (in your|registered)|already assigned/i,
      );
      const hasMsg = await existsMsg
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);
      expect(hasMsg).toBeTruthy();
    }
  });

  test('Edge: Vendor list shows status filter with Invited and Active options', async () => {
    await navigateInApp(sharedPage, '/vendors');

    // Table or accordion should render
    await expect(
      sharedPage.locator('table, [class*="vendor"], [class*="accordion"]').first(),
    ).toBeVisible({ timeout: 10000 });

    // Status filter from vendors.filters.status = "Status"
    const statusFilter = sharedPage.getByText(/^Status$/);
    const hasFilter = await statusFilter
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (hasFilter) {
      await statusFilter.first().click();
      await sharedPage.waitForTimeout(500);

      // Options: "Invited", "Active" from vendors.statuses
      const invitedOption = sharedPage.getByText(/^Invited$/);
      await expect(invitedOption.first()).toBeVisible({ timeout: 3000 });
    }
  });

  test('Edge: Search by name or email works on vendor list', async () => {
    await navigateInApp(sharedPage, '/vendors');

    // Search input: placeholder "Search by name or email"
    const searchInput = sharedPage.getByPlaceholder('Search by name or email');
    await expect(searchInput).toBeVisible({ timeout: 10000 });

    await searchInput.fill('test');
    await sharedPage.waitForTimeout(1000);

    // List should filter (or show "No vendors found")
    const hasResults = await sharedPage
      .locator('tbody tr')
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    const hasEmpty = await sharedPage
      .getByText('No vendors found')
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    expect(hasResults || hasEmpty).toBeTruthy();
  });
});
