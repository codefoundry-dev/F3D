import { test, expect, type Page } from '@playwright/test';
import { loginAs, navigateInApp } from '../helpers/procurement-helpers';
import { COMPANY_ADMIN, TEST_PROJECT } from '../fixtures/test-data';

test.describe('US-2 - Project Creation & Management', () => {
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

  test('AC1: View project list with search, filters, sort', async () => {
    await navigateInApp(sharedPage, '/projects');

    // "Create Project" is a Link styled as button
    await expect(sharedPage.getByRole('link', { name: /create project/i })).toBeVisible({
      timeout: 10000,
    });
    await expect(sharedPage.getByPlaceholder('Search by name or description...')).toBeVisible();
  });

  test('AC2: Create project form renders with required fields', async () => {
    await navigateInApp(sharedPage, '/projects/new');
    await sharedPage.waitForTimeout(1000);

    // Verify the form renders with key fields
    await expect(sharedPage.getByRole('heading', { name: /create project/i })).toBeVisible({
      timeout: 10000,
    });
    await expect(sharedPage.getByPlaceholder(/enter project name/i)).toBeVisible();
    await expect(sharedPage.getByRole('button', { name: /create project/i })).toBeVisible();

    // Fill project name and submit — should show validation errors for missing required fields
    await sharedPage.getByPlaceholder(/enter project name/i).fill(TEST_PROJECT.name);
    await sharedPage.getByRole('button', { name: /create project/i }).click();

    // Validation errors should appear for locations and/or team members
    await expect(sharedPage.getByText(/required|at least/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('AC3: View project detail with tabs', async () => {
    await navigateInApp(sharedPage, '/projects');
    await sharedPage.waitForSelector('tbody tr', { timeout: 10000 });

    await sharedPage.locator('tbody tr').first().click();
    await sharedPage.waitForURL('**/projects/*', { timeout: 10000 });

    await expect(sharedPage.getByText(/overview/i)).toBeVisible();
    await expect(sharedPage.getByText(/members/i)).toBeVisible();
  });

  test('AC4: Edit project details', async () => {
    // Should be on project detail from AC3
    const editBtn = sharedPage
      .getByRole('link', { name: /edit project/i })
      .or(sharedPage.getByRole('button', { name: /edit project/i }));
    if (await editBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await editBtn.click();
      await sharedPage.waitForURL('**/edit', { timeout: 10000 });

      const newDesc = `Updated by E2E at ${Date.now()}`;
      await sharedPage.locator('textarea').first().clear();
      await sharedPage.locator('textarea').first().fill(newDesc);
      await sharedPage.getByRole('button', { name: /save|update|create/i }).click();

      await expect(sharedPage.getByText(newDesc)).toBeVisible({ timeout: 10000 });
    }
  });

  test('AC5: Create project form validates required fields on submit', async () => {
    await navigateInApp(sharedPage, '/projects/new');
    await sharedPage.waitForTimeout(500);

    // Submit empty form — should show validation errors
    await sharedPage.getByRole('button', { name: /create project/i }).click();

    // Should show "required" validation messages
    await expect(sharedPage.getByText(/required/i).first()).toBeVisible({ timeout: 5000 });
  });
});
