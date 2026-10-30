import type { PoDetail } from '@forethread/api-client';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

// Array keys resolve to the first one that "exists" — only vendorStatus.ACCEPTED
// and vendorStatus.SENT do, mirroring purchaseOrders.json.
const VENDOR_KEYS = new Set(['vendorStatus.ACCEPTED', 'vendorStatus.SENT']);
vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({
    t: (key: string | string[]) =>
      Array.isArray(key) ? (key.find((k) => VENDOR_KEYS.has(k)) ?? key[key.length - 1]) : key,
  }),
}));

vi.mock('@forethread/ui-components', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => (
    <span data-testid="badge">{children}</span>
  ),
  getStatusColor: () => '',
  PO_STATUS_COLORS: {},
  formatCurrency: (v: number | null) => String(v ?? '-'),
}));

vi.mock('@forethread/rfq-shared', () => ({
  DetailField: ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div>
      {label} {value}
    </div>
  ),
  SectionDivider: () => <hr />,
  SectionTitle: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
  formatDate: (v: string | null) => v ?? '-',
}));

import { PoDetailsTab } from './PoDetailsTab';

const basePo = {
  id: 'po-1',
  poNumber: 'PO-00001',
  documentName: 'Steel',
  projectName: 'Tower',
  projectCode: 'PRJ-2026-001',
  status: 'ACCEPTED',
  poType: 'STANDARD',
  company: { id: 'c-1', name: 'Buyer Co' },
  vendor: { id: 'v-1', name: 'Vendor Co' },
  createdBy: { id: 'u-1', name: 'Sam' },
  approvedBy: null,
  lastModifiedBy: null,
  createdAt: '2026-10-01T00:00:00.000Z',
  deliveries: [],
  termsAndConditions: null,
} as unknown as PoDetail;

describe('PoDetailsTab', () => {
  it.each(['page', 'panel'] as const)(
    'labels a vendor-approved PO "Approved" for the vendor (%s, FOR-397)',
    (layout) => {
      render(<PoDetailsTab po={basePo} layout={layout} isVendorView />);
      expect(screen.getByTestId('badge')).toHaveTextContent('vendorStatus.ACCEPTED');
    },
  );

  it('keeps the real status for the buyer', () => {
    render(<PoDetailsTab po={basePo} layout="page" />);
    expect(screen.getByTestId('badge')).toHaveTextContent('status.ACCEPTED');
  });

  it.each([
    ['page', true],
    ['panel', true],
    ['panel', false],
  ] as const)(
    'shows the PO terms & conditions (%s, vendor=%s, FOR-398)',
    (layout, isVendorView) => {
      const po = { ...basePo, termsAndConditions: '1. Deliver on time.\n2. Invoice monthly.' };
      render(<PoDetailsTab po={po} layout={layout} isVendorView={isVendorView} />);
      expect(screen.getByText('detailFields.termsAndConditions')).toBeInTheDocument();
      expect(screen.getByTestId('po-terms-and-conditions').textContent).toBe(
        '1. Deliver on time.\n2. Invoice monthly.',
      );
    },
  );

  it('omits the section when the PO has no terms', () => {
    render(<PoDetailsTab po={basePo} layout="page" isVendorView />);
    expect(screen.queryByTestId('po-terms-and-conditions')).not.toBeInTheDocument();
  });
});
