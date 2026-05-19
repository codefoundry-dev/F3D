import { defineConfig, devices } from '@playwright/test';

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
    baseURL: process.env.BASE_URL,
    actionTimeout: 10000,
  },
  projects: [
    {
      name: 'super-admin',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:3001',
      },
      testMatch: /us010[1-5]|us07-material|us12-system/,
    },
    {
      name: 'company-admin',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:3002',
      },
      testMatch: /us010[6-9]|us02|us0[3-689](?!0)|us10[0-9]{2}|us1[1-5]/,
    },
    {
      name: 'vendor-app',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:3003',
      },
      testMatch: /us030[0-9]/,
    },
  ],
  /* Start servers manually before running tests:
   *   pnpm --filter backend dev
   *   pnpm --filter super-admin-app dev
   *   pnpm --filter company-admin-app dev
   */
});
