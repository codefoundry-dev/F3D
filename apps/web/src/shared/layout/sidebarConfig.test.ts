import { UserRole } from '@forethread/shared-types/client';
import { describe, expect, it } from 'vitest';

import { getSidebarItemsForRole } from './sidebarConfig';

const LABELS = {
  adminPanel: 'Admin panel',
  usersManagement: 'Users management',
  projects: 'Projects',
  materialRequests: 'Material Requests',
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
      'Material Requests',
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

  it('shows material requests + settings to WAREHOUSE_OFFICER', () => {
    // The Warehouse officer holds materialRequest.list, so the Material Requests
    // item is visible alongside Settings.
    const labels = getSidebarItemsForRole(UserRole.WAREHOUSE_OFFICER, '/', LABELS).map(
      (i) => i.label,
    );
    expect(labels).toEqual(['Material Requests', 'Settings']);
  });

  it('shows admin panel, users management, materials + settings to SUPER_ADMIN', () => {
    // SUPER_ADMIN gets the platform-admin items (Admin panel + Users management) plus
    // the public material catalogue / approval queue (US 4.01) and Settings, in the
    // order shown on the super-admin dashboard frame.
    const labels = getSidebarItemsForRole(UserRole.SUPER_ADMIN, '/', LABELS).map((i) => i.label);
    expect(labels).toEqual(['Admin panel', 'Users management', 'Materials', 'Settings']);
  });

  it('marks the Users management item active on /users and its sub-routes for SUPER_ADMIN', () => {
    const onList = getSidebarItemsForRole(UserRole.SUPER_ADMIN, '/users', LABELS);
    expect(onList.find((i) => i.label === 'Users management')?.isActive).toBe(true);
    const onDetail = getSidebarItemsForRole(UserRole.SUPER_ADMIN, '/users/u-123', LABELS);
    expect(onDetail.find((i) => i.label === 'Users management')?.isActive).toBe(true);
  });

  it('marks the RFQs item active when pathname starts with /rfqs', () => {
    const items = getSidebarItemsForRole(UserRole.COMPANY_ADMIN, '/rfqs/123', LABELS);
    const rfqItem = items.find((i) => i.label === 'RFQs');
    expect(rfqItem?.isActive).toBe(true);
  });
});
