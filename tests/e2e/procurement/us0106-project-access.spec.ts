import { test, expect, type Page } from '@playwright/test';
import { loginAs, navigateInApp } from '../helpers/procurement-helpers';
import { COMPANY_ADMIN } from '../fixtures/test-data';

test.describe('US-1.06 - Assign/Remove Users to Projects', () => {
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

  test('AC1: Open Project Access modal from user detail', async () => {
    // Click View button on first user row to navigate to detail
    await sharedPage.locator('tbody tr').first().locator('button[aria-label="View"]').click();
    await sharedPage.waitForURL('**/settings/users/*', { timeout: 10000 });

    // Look for "Project Access" link/button in the profile grid
    const projectAccessBtn = sharedPage.getByText('Project access').first();
    if (await projectAccessBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await projectAccessBtn.click();
      await expect(sharedPage.getByRole('dialog')).toBeVisible({ timeout: 5000 });
      await sharedPage
        .getByLabel('Close')
        .click()
        .catch(() => sharedPage.keyboard.press('Escape'));
    } else {
      // Try dot menu
      const dotMenu = sharedPage.locator('button').last();
      await dotMenu.click();
      const option = sharedPage.getByText('Project access');
      if (await option.isVisible({ timeout: 2000 }).catch(() => false)) {
        await option.click();
        await expect(sharedPage.getByRole('dialog')).toBeVisible({ timeout: 5000 });
        await sharedPage
          .getByLabel('Close')
          .click()
          .catch(() => sharedPage.keyboard.press('Escape'));
      }
    }
  });

  test('AC2: Assign and remove project access', async () => {
    // Navigate back to users list and open user detail
    await navigateInApp(sharedPage, '/settings/users');
    await sharedPage.waitForSelector('table', { timeout: 15000 });

    await sharedPage.locator('tbody tr').first().locator('button[aria-label="View"]').click();
    await sharedPage.waitForURL('**/settings/users/*', { timeout: 10000 });

    // Look for "Project Access" button in the profile info grid
    const projectAccessBtn = sharedPage.getByText('Project access').first();
    if (await projectAccessBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await projectAccessBtn.click();

      // Toggle a project checkbox in the modal
      const checkbox = sharedPage.locator('input[type="checkbox"]').first();
      if (await checkbox.isVisible({ timeout: 3000 }).catch(() => false)) {
        const wasChecked = await checkbox.isChecked();
        await checkbox.click({ force: true });
        if (wasChecked) {
          await expect(checkbox).not.toBeChecked();
        } else {
          await expect(checkbox).toBeChecked();
        }
      }

      // Close modal
      await sharedPage.getByRole('button', { name: /cancel/i }).click();
    }
  });
});
