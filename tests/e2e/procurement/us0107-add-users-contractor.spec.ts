import { test, expect, type Page } from '@playwright/test';
import { loginAs, navigateInApp } from '../helpers/procurement-helpers';
import { COMPANY_ADMIN } from '../fixtures/test-data';

test.describe('US-1.07 - Add Users to Contractor (Company Admin)', () => {
  test.describe.configure({ mode: 'serial' });

  let sharedPage: Page;

  test.beforeAll(async ({ browser }) => {
    sharedPage = await browser.newPage({
      baseURL: 'http://localhost:3002',
    });
    await loginAs(sharedPage, COMPANY_ADMIN.email, COMPANY_ADMIN.password, {
      navigateTo: '/settings/users',
    });
    await sharedPage.waitForSelector('table', { timeout: 15000 });
  });

  test.afterAll(async () => {
    await sharedPage?.close();
  });

  test('AC1: CA opens invite modal and fills mandatory fields', async () => {
    await sharedPage.getByRole('button', { name: /invite user/i }).click();

    const dialog = sharedPage.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    const uniqueEmail = `e2e-ca-${Date.now()}@test.forethread.com`;
    await dialog.getByPlaceholder('Name Surname').fill('CA Invited User');
    await dialog.getByPlaceholder('admin@example.com').fill(uniqueEmail);

    // Role dropdown (CustomDropdown)
    await dialog.locator('button[aria-haspopup="listbox"]').click();
    await sharedPage
      .locator('[role="listbox"] [role="option"]')
      .filter({ hasText: 'Procurement Officer' })
      .click();

    await dialog.getByPlaceholder('Enter position').fill('Test Position');

    await dialog.getByRole('button', { name: 'Send Invitation' }).click();

    // Success: email shown in invitation success view
    await expect(dialog.getByText(uniqueEmail)).toBeVisible({ timeout: 10000 });

    // Close success modal
    await sharedPage
      .getByLabel('Close')
      .click()
      .catch(() => sharedPage.keyboard.press('Escape'));
    await sharedPage.waitForTimeout(500);
  });

  test('AC2: Role dropdown includes Company Admin option', async () => {
    await sharedPage.getByRole('button', { name: /invite user/i }).click();

    const dialog = sharedPage.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Open role dropdown
    await dialog.locator('button[aria-haspopup="listbox"]').click();
    await expect(
      sharedPage.locator('[role="listbox"] [role="option"]').filter({ hasText: 'Company Admin' }),
    ).toBeVisible();

    // Close dropdown
    await sharedPage.keyboard.press('Escape');
    await sharedPage.waitForTimeout(200);
    // Close modal
    await sharedPage
      .getByLabel('Close')
      .click()
      .catch(() => sharedPage.keyboard.press('Escape'));
    await sharedPage.waitForTimeout(500);
  });

  test('AC3: Success modal shows email confirmation', async () => {
    await sharedPage.getByRole('button', { name: /invite user/i }).click();

    const dialog = sharedPage.getByRole('dialog');
    const uniqueEmail = `e2e-success-${Date.now()}@test.forethread.com`;

    await dialog.getByPlaceholder('Name Surname').fill('Success Modal User');
    await dialog.getByPlaceholder('admin@example.com').fill(uniqueEmail);
    await dialog.locator('button[aria-haspopup="listbox"]').click();
    await sharedPage
      .locator('[role="listbox"] [role="option"]')
      .filter({ hasText: 'Procurement Officer' })
      .click();
    await dialog.getByPlaceholder('Enter position').fill('Tester');

    await dialog.getByRole('button', { name: 'Send Invitation' }).click();

    // Invitation success shows the email
    await expect(dialog.getByText(uniqueEmail)).toBeVisible({ timeout: 10000 });
    await expect(dialog.getByText(/invitation has been sent/i).first()).toBeVisible();

    await sharedPage
      .getByLabel('Close')
      .click()
      .catch(() => sharedPage.keyboard.press('Escape'));
    await sharedPage.waitForTimeout(500);
  });

  test('AC4: New user appears in list with "Invited" status', async () => {
    const uniqueEmail = `e2e-list-${Date.now()}@test.forethread.com`;

    await sharedPage.getByRole('button', { name: /invite user/i }).click();
    const dialog = sharedPage.getByRole('dialog');

    await dialog.getByPlaceholder('Name Surname').fill('List Check User');
    await dialog.getByPlaceholder('admin@example.com').fill(uniqueEmail);
    await dialog.locator('button[aria-haspopup="listbox"]').click();
    await sharedPage
      .locator('[role="listbox"] [role="option"]')
      .filter({ hasText: 'Procurement Officer' })
      .click();
    await dialog.getByPlaceholder('Enter position').fill('Tester');

    await dialog.getByRole('button', { name: 'Send Invitation' }).click();
    await expect(dialog.getByText(uniqueEmail)).toBeVisible({ timeout: 10000 });

    // Close success modal
    await sharedPage
      .getByLabel('Close')
      .click()
      .catch(() => sharedPage.keyboard.press('Escape'));
    await sharedPage.waitForTimeout(1000);

    // Verify user appears in the list with Invited status
    const row = sharedPage.locator('tr', { hasText: uniqueEmail });
    await expect(row).toBeVisible({ timeout: 10000 });
    await expect(row.getByText('Invited')).toBeVisible();
  });

  test('Edge: Duplicate email prevents invitation', async () => {
    await sharedPage.getByRole('button', { name: /invite user/i }).click();
    const dialog = sharedPage.getByRole('dialog');

    await dialog.getByPlaceholder('Name Surname').fill('Duplicate User');
    await dialog.getByPlaceholder('admin@example.com').fill(COMPANY_ADMIN.email);
    await dialog.locator('button[aria-haspopup="listbox"]').click();
    await sharedPage
      .locator('[role="listbox"] [role="option"]')
      .filter({ hasText: 'Procurement Officer' })
      .click();
    await dialog.getByPlaceholder('Enter position').fill('Tester');

    await dialog.getByRole('button', { name: 'Send Invitation' }).click();
    await sharedPage.waitForTimeout(2000);

    // The dialog should still be open (not transition to success step)
    // Success step shows "Invitation has been sent" — if NOT visible, the duplicate was caught
    const successText = dialog.getByText(/invitation has been sent/i);
    const isSuccess = await successText.isVisible({ timeout: 3000 }).catch(() => false);
    expect(isSuccess).toBe(false);

    await sharedPage.keyboard.press('Escape');
    await sharedPage.waitForTimeout(500);
  });

  test('Edge: Missing required fields show validation errors', async () => {
    await sharedPage.getByRole('button', { name: /invite user/i }).click();
    const dialog = sharedPage.getByRole('dialog');

    // Submit without filling anything
    await dialog.getByRole('button', { name: 'Send Invitation' }).click();

    // Validation errors should appear
    await expect(dialog.getByText(/required/i).first()).toBeVisible({ timeout: 5000 });

    await sharedPage
      .getByLabel('Close')
      .click()
      .catch(() => sharedPage.keyboard.press('Escape'));
    await sharedPage.waitForTimeout(300);
  });
});
