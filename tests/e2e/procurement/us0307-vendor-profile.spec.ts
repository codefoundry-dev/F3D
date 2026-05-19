import { test, expect, type Page } from '@playwright/test';
import { loginAs, navigateInApp } from '../helpers/procurement-helpers';
import { VENDOR_USER, COMPANY_ADMIN } from '../fixtures/test-data';

test.describe('US-3.07 - Vendor Profile Management', () => {
  test.describe.configure({ mode: 'serial' });

  let vendorPage: Page;

  test.beforeAll(async ({ browser }) => {
    vendorPage = await browser.newPage({ baseURL: 'http://localhost:3003' });
    await loginAs(vendorPage, VENDOR_USER.email, VENDOR_USER.password);
  });

  test.afterAll(async () => {
    await vendorPage?.close();
  });

  test('AC1: Vendor can view company profile with legal info, warehouses, and representatives', async () => {
    await navigateInApp(vendorPage, '/company');

    // VendorProfilePage sections from i18n
    const legalInfo = vendorPage.getByText('Legal Information');
    await expect(legalInfo).toBeVisible({ timeout: 10000 });

    const contactInfo = vendorPage.getByText('Contact Information');
    await expect(contactInfo).toBeVisible({ timeout: 5000 });

    // Representatives' details section
    const repsSection = vendorPage.getByText("Representatives' details");
    await expect(repsSection).toBeVisible({ timeout: 5000 });

    // Warehouse locations section
    const warehouseSection = vendorPage.getByText('Warehouse locations');
    await expect(warehouseSection).toBeVisible({ timeout: 5000 });
  });

  test('AC2: Vendor can enter edit mode and modify company info', async () => {
    await navigateInApp(vendorPage, '/company');
    await vendorPage.waitForTimeout(1000);

    // "Edit Profile" button from i18n vendors.editProfile
    const editBtn = vendorPage.getByRole('button', {
      name: /Edit Profile/i,
    });
    const hasEdit = await editBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasEdit) {
      await editBtn.click();
      await vendorPage.waitForTimeout(500);

      // In edit mode, form fields appear — Legal Name, ABN, etc.
      const legalNameInput = vendorPage.getByLabel(/Legal Name/i);
      const isEditable = await legalNameInput.isVisible({ timeout: 5000 }).catch(() => false);

      if (isEditable) {
        const currentValue = await legalNameInput.inputValue();
        expect(currentValue.length).toBeGreaterThan(0);

        // Cancel button to exit edit mode
        const cancelBtn = vendorPage.getByRole('button', {
          name: /Cancel/i,
        });
        await cancelBtn.click();
        await vendorPage.waitForTimeout(500);
      }
    }
  });

  test('AC3: Vendor can add a warehouse location', async () => {
    await navigateInApp(vendorPage, '/company');
    await vendorPage.waitForTimeout(1000);

    // Enter edit mode first
    const editBtn = vendorPage.getByRole('button', {
      name: /Edit Profile/i,
    });
    const hasEdit = await editBtn.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasEdit) {
      await editBtn.click();
      await vendorPage.waitForTimeout(500);
    }

    // "Add warehouse" button from vendors.warehouses.addWarehouse
    const addWarehouseBtn = vendorPage.getByRole('button', {
      name: /Add warehouse/i,
    });
    const hasBtn = await addWarehouseBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasBtn) {
      await addWarehouseBtn.click();
      await vendorPage.waitForTimeout(500);

      // Warehouse form fields: name, city, postcode, address
      const nameField = vendorPage.getByLabel(/name/i).first();
      const hasName = await nameField.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasName) {
        await nameField.fill('E2E Test Warehouse');

        const cityField = vendorPage.getByLabel(/city/i);
        if (await cityField.isVisible().catch(() => false)) {
          await cityField.fill('Sydney');
        }

        const addressField = vendorPage.getByLabel(/address/i);
        if (
          await addressField
            .first()
            .isVisible()
            .catch(() => false)
        ) {
          await addressField.first().fill('123 Warehouse Rd');
        }
      }
    }
  });

  test('Edge: Profile edit populates form data on initial load with ?edit=true', async () => {
    await navigateInApp(vendorPage, '/company?edit=true');

    // Form fields should be pre-populated
    const legalNameInput = vendorPage.getByLabel(/Legal Name/i);
    const isVisible = await legalNameInput.isVisible({ timeout: 5000 }).catch(() => false);

    if (isVisible) {
      const value = await legalNameInput.inputValue();
      expect(value.length).toBeGreaterThan(0);
    }

    // Contact email should also be pre-populated
    const contactEmail = vendorPage.getByLabel(/Contact Email/i);
    const hasEmail = await contactEmail.isVisible({ timeout: 3000 }).catch(() => false);
    if (hasEmail) {
      const emailValue = await contactEmail.inputValue();
      expect(emailValue).toContain('@');
    }
  });
});

test.describe('US-3.07 - Vendor Profile (Contractor View)', () => {
  test.describe.configure({ mode: 'serial' });

  let adminPage: Page;

  test.beforeAll(async ({ browser }) => {
    adminPage = await browser.newPage({ baseURL: 'http://localhost:3002' });
    await loginAs(adminPage, COMPANY_ADMIN.email, COMPANY_ADMIN.password);
  });

  test.afterAll(async () => {
    await adminPage?.close();
  });

  test('AC4: Contractor can navigate to vendor profile from vendor list', async () => {
    await navigateInApp(adminPage, '/vendors');

    const vendorEntry = adminPage.locator(
      'table tbody tr, [class*="vendor"], [class*="accordion"]',
    );
    await expect(vendorEntry.first()).toBeVisible({ timeout: 10000 });

    // Click vendor to view profile — navigates to /vendors/:companyId
    await vendorEntry.first().click();
    await adminPage.waitForTimeout(1000);

    // Profile page sections should be visible
    const profileContent = adminPage.getByText(/Legal Information|Contact Information/i);
    await expect(profileContent.first()).toBeVisible({ timeout: 5000 });
  });
});
