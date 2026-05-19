import { test, expect, request as apiRequest } from '@playwright/test';
import { SUPER_ADMIN, PASSWORD_RULES } from '../fixtures/test-data';

const MAILHOG_API = process.env.MAILHOG_API ?? 'http://localhost:8025/api';

/** Clear all Mailhog messages. */
async function clearMailhog(): Promise<void> {
  const ctx = await apiRequest.newContext();
  await ctx.delete(`${MAILHOG_API}/v1/messages`);
  await ctx.dispose();
}

/** Extract reset token from password-reset email in Mailhog. */
async function getResetTokenFromMailhog(email: string): Promise<string | null> {
  const ctx = await apiRequest.newContext();
  for (let attempt = 0; attempt < 15; attempt++) {
    const res = await ctx.get(
      `${MAILHOG_API}/v2/search?kind=to&query=${encodeURIComponent(email)}`,
    );
    const data = await res.json();
    const items = data.items ?? [];
    for (const item of items) {
      const body = item.MIME?.Parts?.[0]?.Body ?? item.Content?.Body ?? '';
      const match = body.match(/reset-password\?token=([a-f0-9]{64})/);
      if (match) {
        await ctx.dispose();
        return match[1];
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  await ctx.dispose();
  return null;
}

test.describe('US-1.04 - Password Reset', () => {
  test('AC1: User requests password reset and sees confirmation', async ({ page }) => {
    await page.goto('/login');
    await page.getByText('Forgot password?').click();
    await page.waitForURL('**/forgot-password');

    await page.locator('#email').fill(SUPER_ADMIN.email);
    await page.getByRole('button', { name: 'Send Reset Instructions' }).click();

    // "Check Your Email" heading appears
    await expect(page.getByRole('heading', { name: /check your email/i })).toBeVisible({
      timeout: 10000,
    });
  });

  test('AC2: Reset password form validates password rules', async ({ page }) => {
    // Reset page does NOT validate token upfront — form renders immediately
    await page.goto(
      '/reset-password?token=e2e-validation-test-000000000000000000000000000000000000',
    );

    // Fill too-short password — real-time validation shows requirements checklist
    await page.locator('#newPassword').fill(PASSWORD_RULES.tooShort);
    await page.locator('#confirmPassword').fill(PASSWORD_RULES.tooShort);

    // Submit button is disabled when password is invalid
    await expect(page.getByRole('button', { name: 'Reset password' })).toBeDisabled();

    // Password requirements checklist should show validation rules
    await expect(page.getByText(/at least 8 characters/i)).toBeVisible();
  });

  test('AC3: Successful reset redirects to login', async ({ page }) => {
    // First trigger a real password reset to get a valid token
    await clearMailhog();
    await page.goto('/forgot-password');
    await page.locator('#email').fill(SUPER_ADMIN.email);
    await page.getByRole('button', { name: 'Send Reset Instructions' }).click();
    await expect(page.getByRole('heading', { name: /check your email/i })).toBeVisible({
      timeout: 10000,
    });

    // Get real reset token from Mailhog
    const resetToken = await getResetTokenFromMailhog(SUPER_ADMIN.email);
    if (!resetToken) {
      test.skip(true, 'Could not retrieve reset token from Mailhog');
      return;
    }

    // Use the real token — reset to same password to avoid breaking other tests
    await page.goto(`/reset-password?token=${resetToken}`);
    await page.locator('#newPassword').fill(SUPER_ADMIN.password);
    await page.locator('#confirmPassword').fill(SUPER_ADMIN.password);
    await page.getByRole('button', { name: 'Reset password' }).click();

    // Should show success with redirect countdown or redirect to login
    await expect(page.getByText(/password reset successful|redirecting|log in/i)).toBeVisible({
      timeout: 10000,
    });
  });
});
