/* eslint-disable @typescript-eslint/no-explicit-any */
import type { BulkOrderListItem } from '@forethread/api-client';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/ui-components', () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
  BULK_ORDER_STATUS_COLORS: {},
  DotActionsMenu: () => <div data-testid="dot-actions" />,
  formatCurrency: (n: number) => `$${n}`,
  formatDate: (d: string) => d,
  formatStatus: (s: string) => s,
  getStatusColor: () => '',
  SortIcon: () => <span data-testid="sort-icon" />,
  Spinner: () => <span data-testid="spinner" />,
}));

vi.mock('@forethread/ui-components/assets/icons/eye-opened.svg?react', () => ({
  default: () => <span data-testid="eye-icon" />,
}));

import { render, screen } from '@testing-library/react';

import { BulkOrderTable } from './BulkOrderTable';

function makeItem(overrides: Partial<BulkOrderListItem> = {}): BulkOrderListItem {
  return {
    id: 'bo-1',
    bulkOrderNumber: 'BULK-2025-011',
    projectName: 'Bayside Transit',
    projectId: 'proj-uuid-1',
    projectCode: 'PRJ-2024-015',
    companyId: 'c1',
    contractorName: 'Acme',
    vendorId: 'v1',
    vendorName: 'Stellar Engineering',
    status: 'ACTIVE',
    brands: null,
    lineItems: 1234,
    deliveriesPercent: 88,
    amountCount: 1,
    totalAmount: 10000000,
    solidGold: null,
    date: '2025-01-01',
    validUntil: '2025-01-15',
    consumptionPercent: 12,
    ...overrides,
  };
}

const noop = () => undefined;

function renderTable(items: BulkOrderListItem[]) {
  return render(
    <BulkOrderTable
      items={items}
      isLoading={false}
      sortBy="id"
      sortDir="asc"
      onSort={noop}
      onRowClick={noop}
      onView={noop}
    />,
  );
}

describe('BulkOrderTable', () => {
  it('renders the Utilization column from consumptionPercent, not deliveriesPercent', () => {
    renderTable([makeItem({ consumptionPercent: 12, deliveriesPercent: 88 })]);
    expect(screen.getByText('12%')).toBeInTheDocument();
    expect(screen.queryByText('88%')).not.toBeInTheDocument();
  });

  it('falls back to 0% when consumptionPercent is undefined', () => {
    renderTable([makeItem({ consumptionPercent: undefined })]);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('renders the bulk order number and core columns', () => {
    renderTable([makeItem()]);
    expect(screen.getByText('BULK-2025-011')).toBeInTheDocument();
    expect(screen.getByText('Bayside Transit')).toBeInTheDocument();
    // The Project Code column shows the human-readable code, not the UUID.
    expect(screen.getByText('PRJ-2024-015')).toBeInTheDocument();
    expect(screen.queryByText('proj-uuid-1')).not.toBeInTheDocument();
    expect(screen.getByText('1234')).toBeInTheDocument();
  });
});
