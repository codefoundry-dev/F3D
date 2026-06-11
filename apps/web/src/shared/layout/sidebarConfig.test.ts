import { UserRole } from '@forethread/shared-types/client';
import { describe, expect, it } from 'vitest';

import { getSidebarItemsForRole } from './sidebarConfig';

const LABELS = {
  projects: 'Projects',
  rfqs: 'RFQs',
  purchaseOrders: 'POs',
  bulkOrders: 'Bulk',
  invoices: 'Invoices',
  vendors: 'Vendors',
  materialCatalogue: 'Materials',
  settings: 'Settings',
};

describe('getSidebarItemsForRole', () => {
  it('returns nothing when role is null', () => {
    expect(getSidebarItemsForRole(null, '/', LABELS)).toEqual([]);
  });

  it('shows the full buyer-side menu for COMPANY_ADMIN', () => {
    const labels = getSidebarItemsForRole(UserRole.COMPANY_ADMIN, '/', LABELS).map((i) => i.label);
    expect(labels).toEqual([
      'Projects',
      'RFQs',
      'POs',
      'Bulk',
      'Invoices',
      'Vendors',
      'Materials',
      'Settings',
    ]);
  });

  it('hides projects, vendors, and material catalogue from VENDOR', () => {
    const labels = getSidebarItemsForRole(UserRole.VENDOR, '/', LABELS).map((i) => i.label);
    expect(labels).not.toContain('Projects');
    expect(labels).not.toContain('Vendors');
    expect(labels).not.toContain('Materials');
    expect(labels).toContain('RFQs');
    expect(labels).toContain('Invoices');
  });

  it('shows only invoices + settings to FINANCIAL_OFFICER', () => {
    const labels = getSidebarItemsForRole(UserRole.FINANCIAL_OFFICER, '/', LABELS).map(
      (i) => i.label,
    );
    expect(labels).toEqual(['Invoices', 'Settings']);
  });

  it('shows only settings to WAREHOUSE_OFFICER', () => {
    const labels = getSidebarItemsForRole(UserRole.WAREHOUSE_OFFICER, '/', LABELS).map(
      (i) => i.label,
    );
    expect(labels).toEqual(['Settings']);
  });

  it('shows materials + settings to SUPER_ADMIN (owns the catalogue; admin panel reached separately)', () => {
    // SUPER_ADMIN owns the public material catalogue + approval queue (US 4.01),
    // so the Materials item is visible alongside Settings.
    const labels = getSidebarItemsForRole(UserRole.SUPER_ADMIN, '/', LABELS).map((i) => i.label);
    expect(labels).toEqual(['Materials', 'Settings']);
  });

  it('marks the RFQs item active when pathname starts with /rfqs', () => {
    const items = getSidebarItemsForRole(UserRole.COMPANY_ADMIN, '/rfqs/123', LABELS);
    const rfqItem = items.find((i) => i.label === 'RFQs');
    expect(rfqItem?.isActive).toBe(true);
  });
});
