import { test, expect, type Page } from '@playwright/test';
import { loginAs, navigateInApp } from '../helpers/procurement-helpers';
import { COMPANY_ADMIN, TEST_COMPANY } from '../fixtures/test-data';

test.describe('US-1.09 & US-1.10 - Company & User Profile', () => {
  test.describe.configure({ mode: 'serial' });

  let sharedPage: Page;

  test.beforeAll(async ({ browser }) => {
    sharedPage = await browser.newPage({
      baseURL: 'http://localhost:3002',
    });
    await loginAs(sharedPage, COMPANY_ADMIN.email, COMPANY_ADMIN.password, {
      navigateTo: '/settings/company',
    });
  });

  test.afterAll(async () => {
    await sharedPage?.close();
  });

  // ── US-1.09: Contractor Profile Management ──────────────────────

  test('AC1: View company profile with legal info, contacts, specialisations', async () => {
    await expect(sharedPage.getByText('Legal Information')).toBeVisible({ timeout: 10000 });
    await expect(sharedPage.getByText('Legal Name')).toBeVisible();
    await expect(sharedPage.getByText('ABN')).toBeVisible();
    await expect(sharedPage.getByText('Tax Code')).toBeVisible();
    await expect(sharedPage.getByText('Contact Information')).toBeVisible();
    await expect(sharedPage.getByText('Contact Email')).toBeVisible();
  });

  test('AC2: Edit company via modal with ABN and Tax Code validation', async () => {
    await sharedPage.getByRole('button', { name: /edit/i }).first().click();
    await expect(sharedPage.getByText('Edit Company Details')).toBeVisible({ timeout: 5000 });

    // FormField labels don't have htmlFor — use placeholder which equals the label text
    const abnInput = sharedPage.getByPlaceholder('ABN');
    await abnInput.clear();
    await abnInput.fill('1234');
    await sharedPage.getByRole('button', { name: /submit/i }).click();
    await expect(sharedPage.getByText('ABN must be exactly 11 digits')).toBeVisible();

    // Fix ABN, invalid Tax Code
    await abnInput.clear();
    await abnInput.fill(TEST_COMPANY.abn);
    const taxInput = sharedPage.getByPlaceholder('Tax Code');
    await taxInput.clear();
    await taxInput.fill('123456789012');
    await sharedPage.getByRole('button', { name: /submit/i }).click();
    await expect(sharedPage.getByText('Tax code must be 1-11 digits')).toBeVisible();

    // Modal may be taller than viewport — close via Escape key
    await sharedPage.keyboard.press('Escape');
  });

  test('AC3: Save changes and verify updated values displayed', async () => {
    await navigateInApp(sharedPage, '/settings/company');
    await sharedPage.waitForTimeout(500);

    await sharedPage.getByRole('button', { name: /edit/i }).first().click();
    await expect(sharedPage.getByText('Edit Company Details')).toBeVisible({ timeout: 5000 });

    const newTradeName = `E2E Trade ${Date.now()}`;
    const tradeNameInput = sharedPage.getByPlaceholder('Trade Name');
    await tradeNameInput.clear();
    await tradeNameInput.fill(newTradeName);

    // Ensure ABN and Tax Code are valid
    const abnInput = sharedPage.getByPlaceholder('ABN');
    await abnInput.clear();
    await abnInput.fill(TEST_COMPANY.abn);
    const taxInput = sharedPage.getByPlaceholder('Tax Code');
    await taxInput.clear();
    await taxInput.fill(TEST_COMPANY.taxCode);

    await sharedPage.getByRole('button', { name: /submit/i }).click();

    // Modal closes and new value is displayed
    await expect(sharedPage.getByText('Edit Company Details')).not.toBeVisible({ timeout: 5000 });
    await expect(sharedPage.getByText(newTradeName)).toBeVisible({ timeout: 5000 });
  });

  // ── US-1.10: Manage User Profile ────────────────────────────────

  test('AC4: View own profile with info grid', async () => {
    await navigateInApp(sharedPage, '/settings/profile');
    await sharedPage.waitForTimeout(500);

    await expect(sharedPage.getByText(COMPANY_ADMIN.email)).toBeVisible({ timeout: 10000 });
    await expect(sharedPage.getByText('Phone')).toBeVisible();
    await expect(sharedPage.getByText('Status')).toBeVisible();
    await expect(sharedPage.getByText('Role', { exact: true })).toBeVisible();
    await expect(sharedPage.getByText('Date Joined')).toBeVisible();
    await expect(sharedPage.getByText('Position')).toBeVisible();
  });

  test('AC5: Edit profile via modal and submit changes', async () => {
    await sharedPage.getByRole('button', { name: /edit profile/i }).click();
    await expect(sharedPage.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    const newPhone =
      '+61400' +
      Math.floor(Math.random() * 1000000)
        .toString()
        .padStart(6, '0');
    // Phone input placeholder is "+1234567890"
    const phoneInput = sharedPage.getByPlaceholder('+1234567890');
    await phoneInput.clear();
    await phoneInput.fill(newPhone);

    await sharedPage.getByRole('button', { name: /submit changes/i }).click();

    await expect(sharedPage.getByRole('dialog')).not.toBeVisible({ timeout: 5000 });
    await expect(sharedPage.getByText(newPhone)).toBeVisible({ timeout: 5000 });
  });

  test('AC6: Activity log tab shows real audit log entries with timeline UI', async () => {
    // Should still be on /settings/profile from AC5
    const activityLogHeading = sharedPage.getByText('Activity Log');
    await expect(activityLogHeading).toBeVisible({ timeout: 10000 });

    // Timeline entries have date text (formatted datetime)
    const timestampElements = sharedPage.locator('text=/\\d{1,2}\\s\\w+\\s\\d{4}/');
    await expect(timestampElements.first()).toBeVisible({ timeout: 5000 });
  });
});
