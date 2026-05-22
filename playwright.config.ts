import { defineConfig, devices } from '@playwright/test';

/**
 * The legacy per-role apps (super-admin / company-admin / vendor-app on ports
 * 3001 / 3002 / 3003) were removed in commit 545972f. Tests now run against the
 * unified `apps/web` Vite dev server. ADR-0013 captures the consolidation.
 *
 * Start servers manually before running:
 *   pnpm --filter backend dev          # API on :3000
 *   pnpm --filter @forethread/web dev  # Web on :5179
 *   docker compose up mailhog          # Mailhog on :8025 for OTP capture
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 60000,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    trace: 'on-first-retry',
    baseURL: process.env.BASE_URL ?? 'http://localhost:5179',
    actionTimeout: 10000,
  },
  projects: [
    {
      name: 'web',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
