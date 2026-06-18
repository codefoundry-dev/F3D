/* eslint-disable @typescript-eslint/no-explicit-any */
import type { BulkOrderLineItemDetail } from '@forethread/api-client';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/ui-components', () => ({
  formatCurrency: (n: number) => `$${n}`,
}));

vi.mock('@forethread/ui-components/assets/icons/edit-in-square.svg?react', () => ({
  default: () => <span data-testid="edit-icon" />,
}));

import { render, screen } from '@testing-library/react';

import { BulkOrderLineItemsTable } from './BulkOrderLineItemsTable';

function makeLine(overrides: Partial<BulkOrderLineItemDetail> = {}): BulkOrderLineItemDetail {
  return {
    lineItemId: '1234567890',
    itemReference: 'Aluminum Beam 6061',
    description: '12ft, Structural',
    qty: 30,
    unit: 'pcs',
    ordered: 0,
    qtyRemaining: 30,
    deliveriesPercent: 80,
    pricePerUnit: 30,
    totalLineInc: 300,
    consumptionPercent: 12,
    ...overrides,
  };
}

describe('BulkOrderLineItemsTable', () => {
  it('renders the Utilization,% cell from consumptionPercent, not deliveriesPercent', () => {
    render(<BulkOrderLineItemsTable lineItems={[makeLine()]} />);
    expect(screen.getByText('12%')).toBeInTheDocument();
    expect(screen.queryByText('80%')).not.toBeInTheDocument();
  });

  it('falls back to 0% when consumptionPercent is undefined', () => {
    render(<BulkOrderLineItemsTable lineItems={[makeLine({ consumptionPercent: undefined })]} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('shows the total item count in the footer', () => {
    render(
      <BulkOrderLineItemsTable
        lineItems={[makeLine({ lineItemId: 'a' }), makeLine({ lineItemId: 'b' })]}
      />,
    );
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
