/** Test user credentials — must match seeded data in test database. */
export const SUPER_ADMIN = {
  email: process.env.TEST_SA_EMAIL ?? 'superadmin@forethread.local',
  password: process.env.TEST_SA_PASSWORD ?? 'Dev@123456',
};

export const COMPANY_ADMIN = {
  email: process.env.TEST_CA_EMAIL ?? 'companyadmin@testcontractor.local',
  password: process.env.TEST_CA_PASSWORD ?? 'Dev@123456',
};

export const TEST_USER = {
  name: 'E2E Test User',
  email: `e2e-${Date.now()}@test.forethread.com`,
  role: 'Procurement Officer',
  position: 'QA Tester',
};

export const TEST_COMPANY = {
  legalName: 'E2E Test Company Pty Ltd',
  tradeName: 'E2E Co',
  abn: '12345678901',
  taxCode: '123456789',
  contactEmail: 'contact@e2etest.com',
  contactPhone: '+61400000000',
  website: 'https://e2etest.com',
  legalAddress: '123 Test Street, Sydney NSW 2000',
};

export const TEST_PROJECT = {
  name: `E2E Project ${Date.now()}`,
  description: 'Created by e2e tests',
  type: 'Commercial',
  deliveryAddress: '456 Delivery Rd, Melbourne VIC 3000',
  deliveryLabel: 'Site A - Main Gate',
};

export const PROCUREMENT_OFFICER = {
  email: process.env.TEST_PO_EMAIL ?? 'po@testcontractor.local',
  password: process.env.TEST_PO_PASSWORD ?? 'Dev@123456',
};

export const VENDOR_USER = {
  email: process.env.TEST_VENDOR_EMAIL ?? 'vendor@testvendor.local',
  password: process.env.TEST_VENDOR_PASSWORD ?? 'Dev@123456',
};

export const FINANCE_OFFICER = {
  email: process.env.TEST_FO_EMAIL ?? 'finance@testcontractor.local',
  password: process.env.TEST_FO_PASSWORD ?? 'Dev@123456',
};

export const WAREHOUSE_OFFICER = {
  email: process.env.TEST_WH_EMAIL ?? 'warehouse@testcontractor.local',
  password: process.env.TEST_WH_PASSWORD ?? 'Dev@123456',
};

export const FIELD_WORKER = {
  email: process.env.TEST_FW_EMAIL ?? 'foreman@testcontractor.local',
  password: process.env.TEST_FW_PASSWORD ?? 'Dev@123456',
};

/** FOR-197: second contractor used to prove vendors are M:N. */
export const NORTHSIDE_ADMIN = {
  email: process.env.TEST_NORTHSIDE_ADMIN_EMAIL ?? 'companyadmin@northside.local',
  password: process.env.TEST_NORTHSIDE_ADMIN_PASSWORD ?? 'Dev@123456',
};

/** FOR-197: shared vendor seeded against both contractors. */
export const REXEL_VENDOR = {
  legalName: 'Rexel Electrical Supplies',
  contactEmail: 'orders@rexel.local',
  abn: 'TEST-VENDOR-REXEL',
};

export const PASSWORD_RULES = {
  valid: 'NewPass123!',
  tooShort: 'Abc1!',
  noUppercase: 'newpass123!',
  noNumber: 'NewPassword!',
  noSymbol: 'NewPass1234',
};
