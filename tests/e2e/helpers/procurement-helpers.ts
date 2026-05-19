import { type Page, expect, request as apiRequest } from '@playwright/test';

const MAILHOG_API = process.env.MAILHOG_API ?? 'http://localhost:8025/api';

/**
 * Fetch the latest OTP code for a given email address from Mailhog.
 * Only considers emails received after `afterTimestamp` (ISO string) to avoid stale OTPs.
 */
async function getOtpFromMailhog(email: string, afterTimestamp: string): Promise<string> {
  const ctx = await apiRequest.newContext();
  const afterMs = new Date(afterTimestamp).getTime();

  let otp: string | null = null;
  for (let attempt = 0; attempt < 40; attempt++) {
    const res = await ctx.get(
      `${MAILHOG_API}/v2/search?kind=to&query=${encodeURIComponent(email)}`,
    );
    const data = await res.json();
    const items = data.items ?? [];

    // Sort by Created desc to get the NEWEST matching email
    const sorted = [...items].sort((a: any, b: any) => {
      const tA = a.Created ? new Date(a.Created).getTime() : 0;
      const tB = b.Created ? new Date(b.Created).getTime() : 0;
      return tB - tA;
    });
    for (const item of sorted) {
      const created = item.Created ? new Date(item.Created).getTime() : 0;
      if (created < afterMs) continue;

      // Try all MIME parts to find the plain text body with the OTP
      const bodies: string[] = [];
      if (item.MIME?.Parts) {
        for (const part of item.MIME.Parts) {
          if (part.Body) bodies.push(part.Body);
        }
      }
      if (item.Content?.Body) bodies.push(item.Content.Body);

      for (const body of bodies) {
        const match = body.match(/login code is:\s*(\d{6})/);
        if (match) {
          otp = match[1];
          break;
        }
      }
      if (otp) break;
    }
    if (otp) break;
    await new Promise((r) => setTimeout(r, 500));
  }

  await ctx.dispose();
  if (!otp) throw new Error(`OTP not found in Mailhog for ${email} after ${afterTimestamp}`);
  return otp;
}

/**
 * Enter OTP digits into the TwoFactorCard and submit.
 * Uses digit-by-digit fill with delays to allow React state updates between inputs.
 */
async function enterOtpAndSubmit(page: Page, otp: string) {
  for (let i = 0; i < otp.length; i++) {
    await page.getByLabel(`Digit ${i + 1}`).fill(otp[i]);
    // Allow React to process the state update and re-render before next digit
    await page.waitForTimeout(150);
  }
  await page.getByRole('button', { name: 'Verify Code' }).click();
}

/**
 * Login as a user, complete OTP verification, and optionally navigate
 * to a target path using client-side routing (no full reload).
 *
 * Uses a request intercept to ensure the correct OTP is sent to the backend,
 * even if React's state management loses digits during rapid input.
 *
 * IMPORTANT: After login, do NOT use page.goto() for SPA routes — the
 * auth token lives in memory and is lost on full page reload.
 * Use navigateInApp() instead.
 */
export async function loginAs(
  page: Page,
  email: string,
  password: string,
  opts?: { navigateTo?: string },
) {
  await page.goto('/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);

  // Record timestamp just before clicking login — the OTP email will be sent after this
  const loginTimestamp = new Date().toISOString();
  await page.getByRole('button', { name: 'Log in' }).click();

  await page.waitForURL('**/verify-otp', { timeout: 15000 });

  // Wait for the OTP email to arrive in Mailhog
  await new Promise((r) => setTimeout(r, 2000));

  // Fetch OTP from Mailhog (only emails after loginTimestamp — newest first)
  const otp = await getOtpFromMailhog(email, loginTimestamp);

  // Intercept the verify-otp API request to inject the correct OTP.
  // This protects against React state issues where rapid digit fills
  // may cause the UI to send a corrupted OTP to the backend.
  await page.route('**/auth/verify-otp', async (route, request) => {
    try {
      const body = JSON.parse(request.postData() ?? '{}');
      body.otp = otp;
      await route.continue({
        postData: JSON.stringify(body),
        headers: {
          ...request.headers(),
          'content-type': 'application/json',
        },
      });
    } catch {
      await route.continue();
    }
  });

  await enterOtpAndSubmit(page, otp);

  // Wait for redirect away from verify-otp
  const redirected = await page
    .waitForURL((url) => !url.pathname.includes('verify-otp'), { timeout: 15000 })
    .then(() => true)
    .catch(() => false);

  // Remove the route intercept
  await page.unroute('**/auth/verify-otp');

  if (!redirected) {
    const errorText = await page
      .locator('.text-destructive, [role="alert"]')
      .textContent()
      .catch(() => '');
    if (errorText?.includes('Invalid code') || errorText?.includes('expired')) {
      // OTP was stale or expired — re-login and get a fresh OTP
      await page.goto('/login');
      await page.locator('#email').fill(email);
      await page.locator('#password').fill(password);
      const retryTimestamp = new Date().toISOString();
      await page.getByRole('button', { name: 'Log in' }).click();
      await page.waitForURL('**/verify-otp', { timeout: 15000 });
      await new Promise((r) => setTimeout(r, 2000));

      const retryOtp = await getOtpFromMailhog(email, retryTimestamp);

      // Set up intercept for retry
      await page.route('**/auth/verify-otp', async (route, request) => {
        try {
          const body = JSON.parse(request.postData() ?? '{}');
          body.otp = retryOtp;
          await route.continue({
            postData: JSON.stringify(body),
            headers: {
              ...request.headers(),
              'content-type': 'application/json',
            },
          });
        } catch {
          await route.continue();
        }
      });

      await enterOtpAndSubmit(page, retryOtp);

      await page
        .waitForURL((url) => !url.pathname.includes('verify-otp'), { timeout: 15000 })
        .catch(async () => {
          const err = await page
            .locator('.text-destructive, [role="alert"]')
            .textContent()
            .catch(() => '');
          throw new Error(`OTP retry failed. Error: "${err}". OTP: ${retryOtp}`);
        });

      await page.unroute('**/auth/verify-otp');
    } else {
      throw new Error(`Login stuck on verify-otp. Error: "${errorText}". OTP: ${otp}`);
    }
  }

  // Navigate to target path if specified (using SPA routing)
  if (opts?.navigateTo) {
    await navigateInApp(page, opts.navigateTo);
  }
}

/**
 * Navigate within the SPA without full page reload (preserves in-memory auth).
 * Uses pushState + popstate which triggers createBrowserRouter's history listener.
 */
export async function navigateInApp(page: Page, path: string) {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  await page.waitForLoadState('networkidle');
  // Give React Router time to render the new route
  await page.waitForTimeout(500);
}

/** Open the dot-actions menu on a table row containing the given text. */
export async function openRowActions(page: Page, rowText: string) {
  const row = page.locator('tr', { hasText: rowText });
  await row.getByLabel('Actions').click();
}

/** Expect a toast notification with the given text to appear. */
export async function expectToast(page: Page, text: string) {
  await expect(page.getByText(text)).toBeVisible({ timeout: 5000 });
}

/** Fill a form field by its label text. */
export async function fillField(page: Page, label: string, value: string) {
  await page.getByLabel(label).fill(value);
}

/** Select an option from a dropdown identified by label. */
export async function selectOption(page: Page, label: string, value: string) {
  await page.getByLabel(label).click();
  await page.getByRole('option', { name: value }).click();
}

/** Wait for the table to have at least N rows (excluding header). */
export async function expectTableRows(page: Page, minCount: number) {
  await expect(page.locator('tbody tr')).toHaveCount(minCount, {
    timeout: 10000,
  });
}
