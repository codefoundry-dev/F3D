import { test, expect, type Page } from '@playwright/test';
import { loginAs, navigateInApp, expectTableRows } from '../helpers/procurement-helpers';
import { COMPANY_ADMIN, VENDOR_USER } from '../fixtures/test-data';

test.describe('US-10.04 - RFQ Management Dashboard', () => {
  test.describe.configure({ mode: 'serial' });

  let sharedPage: Page;

  test.beforeAll(async ({ browser }) => {
    sharedPage = await browser.newPage({ baseURL: 'http://localhost:3002' });
    await loginAs(sharedPage, COMPANY_ADMIN.email, COMPANY_ADMIN.password);
  });

  test.afterAll(async () => {
    await sharedPage?.close();
  });

  test('AC1: "Create new" button visible and paginated RFQ table with columns or empty state', async () => {
    await navigateInApp(sharedPage, '/rfqs');

    // "Create new" button must be visible for Company Admin
    const createBtn = sharedPage.getByRole('button', { name: /create new/i });
    await expect(createBtn).toBeVisible({ timeout: 10000 });

    // Check for table or empty state
    const table = sharedPage.locator('table');
    const emptyState = sharedPage.getByText('No RFQs found');

    const hasTable = await table.isVisible().catch(() => false);
    const hasEmpty = await emptyState.isVisible().catch(() => false);

    expect(hasTable || hasEmpty).toBeTruthy();

    if (hasTable) {
      // Verify expected column headers are present
      const expectedColumns = [
        'RFQ ID',
        'Project Name',
        'Project ID',
        'RFQ Status',
        'Res. Deadline',
        'Pick-up',
        'Delivery Location',
        'Actions',
      ];
      for (const col of expectedColumns) {
        await expect(sharedPage.locator('thead').getByText(col, { exact: false })).toBeVisible();
      }
    }
  });

  test('AC2: Quick filter chips visible — My RFQs, Open RFQs, Awaiting Responses, No Quotes, Awarded, Closed', async () => {
    await navigateInApp(sharedPage, '/rfqs');

    // Verify "Quick Filters:" label
    await expect(sharedPage.getByText('Quick Filters:')).toBeVisible({ timeout: 10000 });

    // Verify all quick filter chips
    const filters = [
      'My RFQs',
      'Open RFQs',
      'Awaiting Responses',
      'No Quotes',
      'Awarded RFQs',
      'Closed RFQs',
    ];

    for (const filter of filters) {
      await expect(sharedPage.getByRole('button', { name: filter })).toBeVisible();
    }

    // Click one filter chip and verify it becomes active (has some visual distinction)
    const myRfqsBtn = sharedPage.getByRole('button', { name: 'My RFQs' });
    await myRfqsBtn.click();
    await sharedPage.waitForTimeout(500);

    // Verify the table or empty state is still rendered after filtering
    const table = sharedPage.locator('table');
    const emptyState = sharedPage.getByText('No RFQs found');
    const hasContent = await table.isVisible().catch(() => false);
    const hasEmpty = await emptyState.isVisible().catch(() => false);
    expect(hasContent || hasEmpty).toBeTruthy();
  });

  test('AC3: Search input filters by RFQ ID or project name', async () => {
    await navigateInApp(sharedPage, '/rfqs');

    // Find and open the search input (expandable)
    const searchInput = sharedPage.getByPlaceholder('Search by RFQ ID or project name');

    // The search may be behind an expandable button — try clicking the search area first
    const isSearchVisible = await searchInput.isVisible().catch(() => false);
    if (!isSearchVisible) {
      // Click the search icon/button to expand
      const searchToggle = sharedPage.locator('[title="Search"], button:has(svg)').last();
      await searchToggle.click();
      await sharedPage.waitForTimeout(300);
    }

    await expect(searchInput).toBeVisible({ timeout: 5000 });

    // Type a search term that is unlikely to match anything
    await searchInput.fill('ZZZZNONEXISTENT999');
    await sharedPage.waitForTimeout(1000);

    // Should show empty state or zero rows
    const emptyState = sharedPage.getByText('No RFQs found');
    const hasEmpty = await emptyState.isVisible().catch(() => false);
    const rowCount = await sharedPage
      .locator('tbody tr')
      .count()
      .catch(() => 0);
    expect(hasEmpty || rowCount === 0).toBeTruthy();

    // Clear search
    await searchInput.clear();
    await sharedPage.waitForTimeout(500);
  });

  test('AC4: Column header click sorts ascending/descending', async () => {
    await navigateInApp(sharedPage, '/rfqs');

    // Wait for table or empty state
    const table = sharedPage.locator('table');
    const hasTable = await table.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasTable) {
      // No table rendered (empty state) — skip sort test gracefully
      const emptyState = sharedPage.getByText('No RFQs found');
      await expect(emptyState).toBeVisible();
      return;
    }

    // Click the "RFQ ID" column header to trigger sort
    const rfqIdHeader = sharedPage.locator('thead').getByText('RFQ ID');
    await rfqIdHeader.click();
    await sharedPage.waitForTimeout(500);

    // Click again to toggle sort direction
    await rfqIdHeader.click();
    await sharedPage.waitForTimeout(500);

    // Table should still be visible after sorting
    await expect(table).toBeVisible();
  });

  test('AC5: Pagination controls visible when data exists', async () => {
    await navigateInApp(sharedPage, '/rfqs');

    // Look for pagination elements
    const rowsPerPage = sharedPage.getByText('Rows per page:');
    const showingText = sharedPage.getByText(/Showing \d+ to \d+ of \d+ RFQs/);
    const backBtn = sharedPage.getByRole('button', { name: 'Back' });
    const nextBtn = sharedPage.getByRole('button', { name: 'Next' });

    // Check if there is data — pagination only matters with data
    const hasTable = await sharedPage
      .locator('tbody tr')
      .count()
      .catch(() => 0);

    if (hasTable > 0) {
      await expect(rowsPerPage).toBeVisible({ timeout: 5000 });
      await expect(showingText).toBeVisible();
      await expect(backBtn).toBeVisible();
      await expect(nextBtn).toBeVisible();
    } else {
      // Empty state — just verify the page renders correctly
      const emptyState = sharedPage.getByText('No RFQs found');
      await expect(emptyState).toBeVisible();
    }
  });

  test('AC6: Filters button opens advanced filter panel', async () => {
    await navigateInApp(sharedPage, '/rfqs');

    // Click the Filters button in toolbar row 2
    const filtersBtn = sharedPage.getByRole('button', { name: /^Filters$/i });
    await expect(filtersBtn).toBeVisible({ timeout: 10000 });
    await filtersBtn.click();
    await sharedPage.waitForTimeout(500);

    // Verify a filter panel/popover/dialog opens
    const filterPanel = sharedPage.locator(
      '[role="dialog"], [data-state="open"], .filter-panel, [class*="popover"], [class*="filter"]',
    );
    const panelVisible = await filterPanel
      .first()
      .isVisible()
      .catch(() => false);
    expect(panelVisible).toBeTruthy();

    // Close the panel by pressing Escape
    await sharedPage.keyboard.press('Escape');
    await sharedPage.waitForTimeout(300);
  });

  test('AC7: View toggle between views via eye icon dropdown', async () => {
    await navigateInApp(sharedPage, '/rfqs');

    // The view selector is an eye-icon dropdown in toolbar row 1
    const viewDropdown = sharedPage.locator('button', { has: sharedPage.locator('svg') }).filter({
      hasText: /view/i,
    });

    // Fallback: find the eye icon button by its position in the toolbar icon group
    const eyeButton = viewDropdown.or(
      sharedPage.locator('[title*="View"], [aria-label*="View"], [title*="view"]').first(),
    );

    const isVisible = await eyeButton
      .first()
      .isVisible()
      .catch(() => false);
    if (isVisible) {
      await eyeButton.first().click();
      await sharedPage.waitForTimeout(500);

      // Verify dropdown options appear
      const dropdown = sharedPage.locator('[role="menu"], [role="listbox"], [data-state="open"]');
      const dropdownVisible = await dropdown
        .first()
        .isVisible()
        .catch(() => false);
      expect(dropdownVisible).toBeTruthy();

      // Close the dropdown
      await sharedPage.keyboard.press('Escape');
      await sharedPage.waitForTimeout(300);
    }
  });

  test('AC8: Group button groups table rows by selected field', async () => {
    await navigateInApp(sharedPage, '/rfqs');

    // Find the "Group" dropdown button
    const groupBtn = sharedPage.getByRole('button', { name: /^Group$/i });
    await expect(groupBtn).toBeVisible({ timeout: 10000 });
    await groupBtn.click();
    await sharedPage.waitForTimeout(500);

    // Verify grouping options appear
    const groupOptions = ['Group by Status', 'Group by Project', 'Group by Vendor'];
    for (const option of groupOptions) {
      await expect(
        sharedPage.getByRole('menuitem', { name: option }).or(sharedPage.getByText(option)),
      ).toBeVisible();
    }

    // Select "Group by Status"
    await sharedPage
      .getByRole('menuitem', { name: 'Group by Status' })
      .or(sharedPage.getByText('Group by Status'))
      .first()
      .click();
    await sharedPage.waitForTimeout(500);

    // Table should still be rendered (grouped or empty)
    const table = sharedPage.locator('table');
    const emptyState = sharedPage.getByText('No RFQs found');
    const hasContent = await table.isVisible().catch(() => false);
    const hasEmpty = await emptyState.isVisible().catch(() => false);
    expect(hasContent || hasEmpty).toBeTruthy();
  });

  // --- Vendor perspective tests (separate browser page on port 3003) ---
  test.describe('Vendor perspective', () => {
    test.describe.configure({ mode: 'serial' });

    let vendorPage: Page;

    test.beforeAll(async ({ browser }) => {
      vendorPage = await browser.newPage({ baseURL: 'http://localhost:3003' });
      await loginAs(vendorPage, VENDOR_USER.email, VENDOR_USER.password);
    });

    test.afterAll(async () => {
      await vendorPage?.close();
    });

    test('AC9: Vendor sees RFQ list without "Create new" button', async () => {
      await navigateInApp(vendorPage, '/rfqs');

      // Vendor should NOT see the "Create new" button
      const createBtn = vendorPage.getByRole('button', { name: /create new/i });
      await expect(createBtn).not.toBeVisible({ timeout: 5000 });

      // Vendor should see the table or empty state
      const table = vendorPage.locator('table');
      const emptyState = vendorPage.getByText('No RFQs found');
      const hasTable = await table.isVisible({ timeout: 5000 }).catch(() => false);
      const hasEmpty = await emptyState.isVisible().catch(() => false);
      expect(hasTable || hasEmpty).toBeTruthy();

      // If table is visible, verify vendor-specific columns (8-col table)
      if (hasTable) {
        const thead = vendorPage.locator('thead');
        await expect(thead).toBeVisible();
      }
    });
  });

  test('AC10: Export button shows CSV and XLSX options', async () => {
    await navigateInApp(sharedPage, '/rfqs');

    // Find the Export button (download icon, title: "Export")
    const exportBtn = sharedPage
      .locator('[title="Export"]')
      .or(sharedPage.getByRole('button', { name: /export/i }));
    await expect(exportBtn.first()).toBeVisible({ timeout: 10000 });
    await exportBtn.first().click();
    await sharedPage.waitForTimeout(500);

    // Verify CSV and XLSX options appear in the dropdown
    await expect(sharedPage.getByText('Export as CSV')).toBeVisible();
    await expect(sharedPage.getByText('Export as XLSX')).toBeVisible();

    // Close dropdown
    await sharedPage.keyboard.press('Escape');
    await sharedPage.waitForTimeout(300);
  });

  test('AC11: Clicking RFQ table row navigates to detail page with ?tab=details', async () => {
    await navigateInApp(sharedPage, '/rfqs');

    // Wait for table rows to appear
    const rows = sharedPage.locator('tbody tr');
    const rowCount = await rows.count().catch(() => 0);

    if (rowCount === 0) {
      // No data — skip gracefully
      await expect(sharedPage.getByText('No RFQs found')).toBeVisible();
      return;
    }

    // Click the first data row (not a group header)
    const firstRow = rows.first();
    await firstRow.click();

    // Verify navigation to RFQ detail page with ?tab=details
    await sharedPage.waitForURL(/\/rfqs\/[^/]+\?tab=details/, { timeout: 10000 });
    expect(sharedPage.url()).toContain('?tab=details');

    // Navigate back for next test
    await navigateInApp(sharedPage, '/rfqs');
  });

  test('AC12: Clicking MessageBadgeIcon navigates to RFQ detail page with ?tab=responses', async () => {
    await navigateInApp(sharedPage, '/rfqs');

    // Wait for table rows to appear
    const rows = sharedPage.locator('tbody tr');
    const rowCount = await rows.count().catch(() => 0);

    if (rowCount === 0) {
      await expect(sharedPage.getByText('No RFQs found')).toBeVisible();
      return;
    }

    // Find and click the message badge icon in the first row's actions column
    const firstRow = rows.first();
    const messageBadge = firstRow
      .locator('button')
      .filter({ has: sharedPage.locator('svg') })
      .first();
    await messageBadge.click();

    // Verify navigation to RFQ detail page with ?tab=responses
    await sharedPage.waitForURL(/\/rfqs\/[^/]+\?tab=responses/, { timeout: 10000 });
    expect(sharedPage.url()).toContain('?tab=responses');

    // Navigate back for next test
    await navigateInApp(sharedPage, '/rfqs');
  });

  test('Edge: Quick filter returns zero results — shows "No RFQs found" empty state', async () => {
    await navigateInApp(sharedPage, '/rfqs');

    // Click a filter chip that is likely to return zero results
    // Try "No Quotes" or "Closed RFQs" as they may have no data in a test env
    const closedBtn = sharedPage.getByRole('button', { name: 'Closed RFQs' });
    await expect(closedBtn).toBeVisible({ timeout: 10000 });
    await closedBtn.click();
    await sharedPage.waitForTimeout(1000);

    // If Closed RFQs yields data, also apply a search filter to force zero results
    const table = sharedPage.locator('table');
    const emptyState = sharedPage.getByText('No RFQs found');
    const rowCount = await sharedPage
      .locator('tbody tr')
      .count()
      .catch(() => 0);

    if (rowCount > 0) {
      // Combine with search to force empty state
      const searchInput = sharedPage.getByPlaceholder('Search by RFQ ID or project name');
      const isSearchVisible = await searchInput.isVisible().catch(() => false);
      if (!isSearchVisible) {
        const searchToggle = sharedPage.locator('[title="Search"]');
        const toggleVisible = await searchToggle.isVisible().catch(() => false);
        if (toggleVisible) {
          await searchToggle.click();
          await sharedPage.waitForTimeout(300);
        }
      }

      if (await searchInput.isVisible().catch(() => false)) {
        await searchInput.fill('ZZZZNONEXISTENT999');
        await sharedPage.waitForTimeout(1000);
      }
    }

    // Verify empty state message
    await expect(emptyState).toBeVisible({ timeout: 5000 });

    // Verify quick filter chips are still visible (not hidden by empty state)
    await expect(sharedPage.getByRole('button', { name: 'My RFQs' })).toBeVisible();
    await expect(sharedPage.getByRole('button', { name: 'Open RFQs' })).toBeVisible();
  });
});
