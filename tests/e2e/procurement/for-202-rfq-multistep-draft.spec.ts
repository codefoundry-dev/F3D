import { test, expect, type Page } from '@playwright/test';

import { COMPANY_ADMIN } from '../fixtures/test-data';
import { loginAs, navigateInApp } from '../helpers/procurement-helpers';

/**
 * FOR-202 — RFQ multi-step scrollable form.
 *
 * Drives the five-step create flow (Project → Materials → Vendors →
 * Delivery & specs → Review) end-to-end and asserts the draft is persisted
 * server-side (save-as-you-go): the first "Next" POSTs /rfqs/draft and returns
 * a DRAFT id; "Save as draft" lands on the persisted RFQ detail page.
 *
 * Requires the manually-started stack (see playwright.config.ts):
 *   backend :3000 · web :5179 · mailhog :8025 · seeded test DB.
 */
test.describe('FOR-202 - RFQ multi-step create form', () => {
  test.describe.configure({ mode: 'serial' });

  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await loginAs(page, COMPANY_ADMIN.email, COMPANY_ADMIN.password);
  });

  test.afterAll(async () => {
    await page?.close();
  });

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** Open a CustomDropdown by its (placeholder) trigger text and pick the first option. */
  async function selectFirstOption(triggerName: string | RegExp) {
    await page.getByRole('button', { name: triggerName }).click();
    const listbox = page.getByRole('listbox');
    await expect(listbox).toBeVisible();
    await listbox.getByRole('option').first().click();
  }

  /** Pick a guaranteed-future, always-enabled day from the DatePicker under the given field label. */
  async function pickFutureDate(fieldLabel: string) {
    const field = page.locator(`label:has-text("${fieldLabel}")`).locator('..');
    await field.getByText('DD/MM/YYYY').click();
    const portal = page.locator('[data-datepicker-portal]');
    await expect(portal).toBeVisible();
    // Advance one month so every visible day cell is in the future and enabled.
    // Portal button order: [prevMonth, nextMonth, Today, ...day cells].
    await portal.getByRole('button').nth(1).click();
    await portal.getByRole('button', { name: '15', exact: true }).click();
    await expect(portal).toBeHidden();
  }

  // ── The flow ─────────────────────────────────────────────────────────────

  test('completes the five-step form and persists a draft RFQ', async () => {
    await navigateInApp(page, '/rfqs/new');
    await expect(page.getByRole('heading', { name: 'Create RFQ' })).toBeVisible();

    // ── Step 1: Project ──
    await expect(page.getByRole('heading', { name: 'Project', exact: true })).toBeVisible();
    await selectFirstOption(/select a project/i);

    // First "Next" creates the draft server-side (save-as-you-go).
    const draftResponse = page.waitForResponse(
      (r) => r.url().includes('/rfqs/draft') && r.request().method() === 'POST',
    );
    await page.getByTestId('next-step').click();
    const draftRes = await draftResponse;
    expect(draftRes.status()).toBe(201);
    const draftId: string = (await draftRes.json()).data.id;
    expect(draftId).toBeTruthy();

    // ── Step 2: Materials ──
    await expect(page.getByRole('heading', { name: 'Materials', exact: true })).toBeVisible();
    await selectFirstOption(/select a material/i);
    await page.getByPlaceholder('0').fill('10');
    const uom = page.getByPlaceholder('e.g. bag');
    if (!(await uom.inputValue())) await uom.fill('each');
    await page.getByTestId('add-line-item').click();
    await expect(page.getByTestId('line-item-list')).toBeVisible();
    await page.getByTestId('next-step').click();

    // ── Step 3: Vendors ──
    await expect(page.getByRole('heading', { name: 'Vendors', exact: true })).toBeVisible();
    await page.getByTestId('vendor-list').locator('label').first().click();
    await page.getByTestId('next-step').click();

    // ── Step 4: Delivery & specs ──
    await expect(page.getByRole('heading', { name: /delivery/i })).toBeVisible();
    await pickFutureDate('Response deadline');
    await selectFirstOption(/select a delivery location/i);
    await page.getByTestId('next-step').click();

    // ── Step 5: Review → Save as draft ──
    await expect(page.getByRole('heading', { name: 'Review', exact: true })).toBeVisible();
    await page.getByTestId('save-as-draft').click();

    // The draft is persisted: we land on its detail page.
    await page.waitForURL(`**/rfqs/${draftId}`, { timeout: 15000 });
    expect(page.url()).toContain(`/rfqs/${draftId}`);
  });

  test('validates each step before advancing', async () => {
    await navigateInApp(page, '/rfqs/new');
    await expect(page.getByRole('heading', { name: 'Create RFQ' })).toBeVisible();

    // Advancing step 1 without a project shows an error and stays on step 1.
    await page.getByTestId('next-step').click();
    await expect(page.getByText('Select a project')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Project', exact: true })).toBeVisible();
  });
});
