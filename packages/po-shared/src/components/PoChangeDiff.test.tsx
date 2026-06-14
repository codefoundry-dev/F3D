import type { PoChangedFields } from '@forethread/api-client';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key,
  }),
}));

vi.mock('@forethread/ui-components', () => ({
  formatCurrency: (v: unknown) => `$${String(v)}`,
  formatDate: (v: unknown) => `date(${String(v)})`,
}));

vi.mock('@forethread/ui-components/assets/icons/arrow-right.svg?react', () => ({
  default: () => <span data-testid="arrow" />,
}));

import { PoChangeDiff } from './PoChangeDiff';

describe('PoChangeDiff', () => {
  it('renders PO-level field diffs with old struck-through and new value', () => {
    const changed: PoChangedFields = {
      fields: { paymentTermsDays: { from: 30, to: 10 } },
    };
    render(<PoChangeDiff changedFields={changed} />);
    expect(screen.getByText('change.suggestedChanges')).toBeInTheDocument();
    const oldVal = screen.getByText('30');
    expect(oldVal).toHaveClass('line-through');
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('formats currency for unitPrice and date for delivery date in line items', () => {
    const changed: PoChangedFields = {
      lineItems: [
        {
          lineItemId: 'li-1',
          name: 'Aluminum Beam 6061',
          changes: {
            unitPrice: { from: 30, to: 10 },
            expectedDeliveryDate: { from: '2025-01-01', to: '2025-02-01' },
          },
        },
      ],
    };
    render(<PoChangeDiff changedFields={changed} />);
    expect(screen.getByText('Aluminum Beam 6061')).toBeInTheDocument();
    expect(screen.getByText('$30')).toBeInTheDocument();
    expect(screen.getByText('$10')).toBeInTheDocument();
    expect(screen.getByText('date(2025-02-01)')).toBeInTheDocument();
  });

  it('resolves deliveryLocationId to its label when locationOptions provided', () => {
    const changed: PoChangedFields = {
      fields: { deliveryLocationId: { from: 'loc-1', to: 'loc-2' } },
    };
    render(
      <PoChangeDiff
        changedFields={changed}
        locationOptions={[
          { value: 'loc-1', label: 'Site A' },
          { value: 'loc-2', label: 'Site B' },
        ]}
      />,
    );
    expect(screen.getByText('Site A')).toBeInTheDocument();
    expect(screen.getByText('Site B')).toBeInTheDocument();
  });

  it('renders Edit affordances when handlers are supplied', () => {
    const onEditFields = vi.fn();
    render(
      <PoChangeDiff
        changedFields={{ fields: { message: { from: 'a', to: 'b' } } }}
        onEditFields={onEditFields}
      />,
    );
    expect(screen.getByText('change.edit')).toBeInTheDocument();
  });
});
