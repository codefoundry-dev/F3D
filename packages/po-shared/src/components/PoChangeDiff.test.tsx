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
  Alert: ({ children, variant }: { children: React.ReactNode; variant?: string }) => (
    <div data-testid="alert" data-variant={variant}>
      {children}
    </div>
  ),
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

  it('renders a destructive cancellation banner for a cancelPo request (FOR-352)', () => {
    render(<PoChangeDiff changedFields={{ cancelPo: true }} />);
    const alert = screen.getByTestId('alert');
    expect(alert).toHaveAttribute('data-variant', 'destructive');
    expect(screen.getByText('change.cancelBanner')).toBeInTheDocument();
  });

  it('renders removed line items struck-through with a Removed badge (FOR-352)', () => {
    const changed: PoChangedFields = {
      removedLineItems: [{ lineItemId: 'li-2', name: 'Copper Pipe' }],
    };
    render(<PoChangeDiff changedFields={changed} />);
    expect(screen.getByText('change.removedLineItems')).toBeInTheDocument();
    expect(screen.getByText('Copper Pipe')).toHaveClass('line-through');
    expect(screen.getByText('change.removedBadge')).toBeInTheDocument();
  });

  it('renders added line items with a New badge and their key values', () => {
    const changed: PoChangedFields = {
      addedLineItems: [
        {
          name: 'Steel Bolt M10',
          quantityOrdered: 4,
          unitOfMeasure: 'EA',
          unitPrice: 2.5,
          expectedDeliveryDate: '2025-02-01',
          notes: 'urgent',
        },
      ],
    };
    render(<PoChangeDiff changedFields={changed} />);
    expect(screen.getByText('change.addedLineItems')).toBeInTheDocument();
    expect(screen.getByText('Steel Bolt M10')).toBeInTheDocument();
    expect(screen.getByText('change.addedBadge')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('EA')).toBeInTheDocument();
    expect(screen.getByText('$2.5')).toBeInTheDocument();
    expect(screen.getByText('date(2025-02-01)')).toBeInTheDocument();
    expect(screen.getByText('urgent')).toBeInTheDocument();
  });

  it('omits blank optional values on an added line item', () => {
    const changed: PoChangedFields = {
      addedLineItems: [
        { name: 'Bare Line', quantityOrdered: 1, unitOfMeasure: 'EA', unitPrice: 9 },
      ],
    };
    render(<PoChangeDiff changedFields={changed} />);
    expect(screen.getByText('Bare Line')).toBeInTheDocument();
    // The i18n mock resolves labels to their defaultValue (the raw field name).
    expect(screen.queryByText('notes')).not.toBeInTheDocument();
    expect(screen.queryByText('expectedDeliveryDate')).not.toBeInTheDocument();
  });

  describe('catalogue images (FOR-402)', () => {
    const changed: PoChangedFields = {
      lineItems: [
        {
          lineItemId: 'li-1',
          name: 'Aluminum Beam 6061',
          changes: { unitPrice: { from: 30, to: 10 } },
        },
      ],
      removedLineItems: [{ lineItemId: 'li-2', name: 'Copper Wire' }],
      addedLineItems: [
        {
          name: 'Steel Bolt M10',
          materialId: 'mat-9',
          quantityOrdered: 4,
          unitOfMeasure: 'EA',
          unitPrice: 2,
        },
      ],
    };

    it('shows the image of changed and removed lines, looked up by lineItemId', () => {
      render(
        <PoChangeDiff
          changedFields={changed}
          poLineItems={[
            { id: 'li-1', imageUrl: 'https://cdn.example/beam.png' },
            { id: 'li-2', imageUrl: 'https://cdn.example/wire.png' },
          ]}
        />,
      );
      expect(screen.getByRole('img', { name: 'Aluminum Beam 6061' })).toHaveAttribute(
        'src',
        'https://cdn.example/beam.png',
      );
      expect(screen.getByRole('img', { name: 'Copper Wire' })).toHaveAttribute(
        'src',
        'https://cdn.example/wire.png',
      );
      // Added lines are not on the PO yet, so they have no image to look up.
      expect(screen.getAllByTestId('material-image-thumb')).toHaveLength(2);
    });

    it('renders no image without PO lines, or for lines whose material has none', () => {
      const { rerender } = render(<PoChangeDiff changedFields={changed} />);
      expect(screen.queryByTestId('material-image-thumb')).not.toBeInTheDocument();

      rerender(
        <PoChangeDiff
          changedFields={changed}
          poLineItems={[{ id: 'li-1', imageUrl: null }, { id: 'li-2' }]}
        />,
      );
      expect(screen.queryByTestId('material-image-thumb')).not.toBeInTheDocument();
      expect(screen.getByText('Aluminum Beam 6061')).toBeInTheDocument();
      expect(screen.getByText('Copper Wire')).toBeInTheDocument();
    });
  });
});
