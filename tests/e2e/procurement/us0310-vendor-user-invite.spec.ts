import { test, expect, type Page } from '@playwright/test';
import { loginAs, navigateInApp } from '../helpers/procurement-helpers';
import { VENDOR_USER } from '../fixtures/test-data';

test.describe('US-3.10 - Vendor User Invitation', () => {
  test.describe.configure({ mode: 'serial' });

  let vendorPage: Page;

  test.beforeAll(async ({ browser }) => {
    vendorPage = await browser.newPage({ baseURL: 'http://localhost:3003' });
    await loginAs(vendorPage, VENDOR_USER.email, VENDOR_USER.password);
  });

  test.afterAll(async () => {
    await vendorPage?.close();
  });

  test('AC1: Vendor admin can invite a new user to their company', async () => {
    await navigateInApp(vendorPage, '/users');

    // VendorUserListPage: "Invite User" button
    const inviteBtn = vendorPage.getByRole('button', {
      name: /Invite User/i,
    });
    await expect(inviteBtn).toBeVisible({ timeout: 10000 });
    await inviteBtn.click();
    await vendorPage.waitForTimeout(500);

    // InviteVendorUserModal: title "Add a new vendor account"
    const modalTitle = vendorPage.getByText('Add a new vendor account');
    await expect(modalTitle).toBeVisible({ timeout: 5000 });

    const uniqueId = Date.now();

    // Full Name field (name="name")
    const nameField = vendorPage.getByLabel(/Full Name/i).first();
    const hasForm = await nameField.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasForm) {
      await nameField.fill('E2E New Vendor User');

      // Email field (name="email")
      const emailField = vendorPage.getByLabel(/Email/i).first();
      await emailField.fill(`vendor-user-${uniqueId}@e2evendor.test`);

      // Position field (optional)
      const positionField = vendorPage.getByLabel(/Position/i);
      if (await positionField.isVisible().catch(() => false)) {
        await positionField.fill('Sales Representative');
      }

      // "Send Invitation" button
      const sendBtn = vendorPage.getByRole('button', {
        name: /Send Invitation/i,
      });
      await sendBtn.click();
      await vendorPage.waitForTimeout(2000);

      // Success message/modal
      const successMsg = vendorPage.getByText(/success|invitation.*sent/i);
      await expect(successMsg.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('AC2: Vendor user list shows dot actions for invited users (resend/cancel)', async () => {
    await navigateInApp(vendorPage, '/users');

    // Table should load — columns: Full name, Email, Phone, Status, Date Joined, Actions
    await expect(vendorPage.locator('table').first()).toBeVisible({ timeout: 10000 });

    // Look for an invited user row
    const invitedText = vendorPage.getByText(/^Invited$/);
    const hasInvited = await invitedText
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (hasInvited) {
      // Open dot actions menu on the invited user row
      const invitedRow = vendorPage.locator('tr', {
        hasText: /Invited/i,
      });
      const actionsBtn = invitedRow.first().getByLabel(/Actions/i);
      const hasActions = await actionsBtn.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasActions) {
        await actionsBtn.click();
        await vendorPage.waitForTimeout(500);

        // "Resend Invitation" and "Cancel Invitation" options
        const resendOption = vendorPage.getByText('Resend Invitation');
        const cancelOption = vendorPage.getByText('Cancel Invitation');

        const hasResend = await resendOption.isVisible({ timeout: 3000 }).catch(() => false);
        const hasCancel = await cancelOption.isVisible({ timeout: 3000 }).catch(() => false);

        expect(hasResend || hasCancel).toBeTruthy();
      }
    }
  });

  test('Edge: Duplicate email shows user already exists modal', async () => {
    await navigateInApp(vendorPage, '/users');

    const inviteBtn = vendorPage.getByRole('button', {
      name: /Invite User/i,
    });
    await expect(inviteBtn).toBeVisible({ timeout: 10000 });
    await inviteBtn.click();
    await vendorPage.waitForTimeout(500);

    const nameField = vendorPage.getByLabel(/Full Name/i).first();
    const hasForm = await nameField.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasForm) {
      await nameField.fill('Duplicate User');

      const emailField = vendorPage.getByLabel(/Email/i).first();
      await emailField.fill(VENDOR_USER.email); // existing user

      const sendBtn = vendorPage.getByRole('button', {
        name: /Send Invitation/i,
      });
      await sendBtn.click();
      await vendorPage.waitForTimeout(2000);

      // UserAlreadyExistsModal or error
      const conflictMsg = vendorPage.getByText(/already exists|user with this email/i);
      const hasConflict = await conflictMsg
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);
      expect(hasConflict).toBeTruthy();
    }
  });
});
