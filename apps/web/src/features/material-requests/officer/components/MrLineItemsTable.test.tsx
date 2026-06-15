import type { MrLineItemDetail } from '@forethread/api-client';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@forethread/ui-components', () => ({
  formatDate: (d: string) => `date:${d}`,
}));

import { MrLineItemsTable } from './MrLineItemsTable';

function li(overrides: Partial<MrLineItemDetail>): MrLineItemDetail {
  return {
    id: 'line-item-1234-5678',
    materialId: 'm1',
    materialName: '2x4 Lumber',
    description: 'Framing lumber',
    quantity: 50,
    unit: 'Each',
    priority: 'HIGH',
    expectedDeliveryDate: '2026-07-01',
    deliveryLocationId: 'loc-1',
    deliveryLocation: 'Main gate',
    notes: 'Stack by door',
    ...overrides,
  };
}

describe('MrLineItemsTable', () => {
  it('renders an empty message when there are no line items', () => {
    render(<MrLineItemsTable lineItems={[]} />);
    expect(screen.getByText('detail.noLineItems')).toBeInTheDocument();
  });

  it('renders a row per line item with material, qty, unit and location', () => {
    render(<MrLineItemsTable lineItems={[li({})]} />);
    expect(screen.getByTestId('mr-line-items')).toBeInTheDocument();
    expect(screen.getByText('2x4 Lumber')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.getByText('Each')).toBeInTheDocument();
    expect(screen.getByText('Main gate')).toBeInTheDocument();
    expect(screen.getByText('date:2026-07-01')).toBeInTheDocument();
  });

  it('shows an em dash for null fields', () => {
    render(
      <MrLineItemsTable
        lineItems={[
          li({
            materialName: null,
            description: null,
            deliveryLocation: null,
            expectedDeliveryDate: null,
            notes: null,
          }),
        ]}
      />,
    );
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(4);
  });

  it('renders a short line-item id', () => {
    render(<MrLineItemsTable lineItems={[li({ id: 'abcdef1234567890' })]} />);
    expect(screen.getByText('abcdef12')).toBeInTheDocument();
  });
});
