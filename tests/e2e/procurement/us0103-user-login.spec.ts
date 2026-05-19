import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/procurement-helpers';
import { SUPER_ADMIN } from '../fixtures/test-data';

test.describe('US-1.03 - User Login', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('AC1: Active user logs in and is redirected to OTP page', async ({ page }) => {
    await page.locator('#email').fill(SUPER_ADMIN.email);
    await page.locator('#password').fill(SUPER_ADMIN.password);
    await page.getByRole('button', { name: 'Log in' }).click();

    // Should navigate to OTP verification
    await page.waitForURL('**/verify-otp');
    await expect(page.getByText('Two-Factor Authentication')).toBeVisible();
  });

  test('AC2: OTP verification completes login', async ({ page }) => {
    await loginAs(page, SUPER_ADMIN.email, SUPER_ADMIN.password);

    // Should land on dashboard (not on auth pages)
    await expect(page.locator('body')).not.toContainText('Log in');
  });

  test('AC3: Invalid credentials show error message', async ({ page }) => {
    await page.locator('#email').fill('wrong@example.com');
    await page.locator('#password').fill('WrongPass123!');
    await page.getByRole('button', { name: 'Log in' }).click();

    await expect(page.getByText('Incorrect email or password')).toBeVisible();
  });
});
