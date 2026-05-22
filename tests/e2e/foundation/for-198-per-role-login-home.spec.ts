import { test, expect } from '@playwright/test';

import { loginAs } from '../helpers/procurement-helpers';

/**
 * FOR-198 — Frontend consolidation foundation acceptance criterion #4:
 *   "E2E test per role: login → lands on role-appropriate home".
 *
 * Asserts that every role seeded in `apps/backend/prisma/seed.ts` lands on
 * the path declared in `apps/web/src/shared/role/roleHome.ts` after a
 * successful login. The unified `apps/web` shell uses `HomeRedirect` to
 * bounce roles whose canonical landing isn't `/`.
 *
 * Prerequisites (see playwright.config.ts):
 *   - backend running on :3000
 *   - apps/web running on :5179
 *   - Mailhog running on :8025 to capture OTP emails
 *   - DB seeded with the standard test users (`pnpm --filter backend seed`)
 */

interface RoleCase {
  label: string;
  email: string;
  expectedPath: string;
}

const ROLE_HOME_CASES: readonly RoleCase[] = [
  {
    label: 'SUPER_ADMIN',
    email: 'superadmin@forethread.local',
    expectedPath: '/admin-panel',
  },
  {
    label: 'COMPANY_ADMIN',
    email: 'companyadmin@testcontractor.local',
    expectedPath: '/',
  },
  {
    label: 'PROCUREMENT_OFFICER',
    email: 'procurement@testcontractor.local',
    expectedPath: '/',
  },
  {
    label: 'FINANCIAL_OFFICER',
    email: 'financial@testcontractor.local',
    expectedPath: '/invoices',
  },
  {
    label: 'WAREHOUSE_OFFICER',
    email: 'warehouse@testcontractor.local',
    expectedPath: '/',
  },
  {
    label: 'VENDOR',
    email: 'vendor@testvendor.local',
    expectedPath: '/',
  },
];

const SEED_PASSWORD = process.env.TEST_SEED_PASSWORD ?? 'Dev@123456';

test.describe('FOR-198 per-role login → role-appropriate home', () => {
  for (const role of ROLE_HOME_CASES) {
    test(`${role.label} lands on ${role.expectedPath}`, async ({ page }) => {
      await loginAs(page, role.email, SEED_PASSWORD);

      // HomeRedirect can run after the OTP redirect lands on `/`, so wait until
      // the URL settles on the role's canonical home.
      await page.waitForURL(
        (url) => url.pathname === role.expectedPath && !url.pathname.includes('verify-otp'),
        { timeout: 15000 },
      );

      const pathname = new URL(page.url()).pathname;
      expect(pathname).toBe(role.expectedPath);
    });
  }
});
