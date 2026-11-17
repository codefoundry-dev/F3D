import type { PoLineItemDetail } from '@forethread/api-client';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key,
  }),
}));

vi.mock('@forethread/api-client', () => ({
  updatePurchaseOrder: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock('@forethread/ui-components', () => ({
  GridModal: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Input: () => <input />,
  FormField: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Button: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  Alert: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ScrollTable: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  onDigitsOnly: () => undefined,
  formatCurrency: (v: unknown) => `$${String(v)}`,
  formatDate: (v: unknown) => `date(${String(v)})`,
}));

vi.mock('@forethread/ui-components/assets/icons/edit-in-square.svg?react', () => ({
  default: () => <span data-testid="icon-edit" />,
}));
vi.mock('@forethread/ui-components/assets/icons/edit-without-line.svg?react', () => ({
  default: () => <span data-testid="icon-edit-all" />,
}));

import { PoLineItemsTab } from './PoLineItemsTab';

function makeLine(overrides: Partial<PoLineItemDetail> = {}): PoLineItemDetail {
  return {
    id: 'li-1',
    lineNumber: 1,
    materialId: 'mat-1',
    materialName: 'Aluminum Beam 6061',
    materialCode: 'AB-6061',
    description: null,
    quantityOrdered: 10,
    quantityDelivered: 0,
    unitOfMeasure: 'EA',
    unitPrice: 30,
    lineTotal: 300,
    costCode: null,
    expectedDeliveryDate: null,
    deliveryLocation: null,
    notes: null,
    pickUp: false,
    ...overrides,
  };
}

describe('PoLineItemsTab — catalogue image (FOR-402)', () => {
  it.each(['panel', 'page'] as const)(
    'shows the material image next to the name (%s layout)',
    (layout) => {
      render(
        <PoLineItemsTab
          layout={layout}
          readOnly
          lineItems={[makeLine({ imageUrl: 'https://cdn.example/beam.png' })]}
        />,
      );
      expect(screen.getByRole('img', { name: 'Aluminum Beam 6061' })).toHaveAttribute(
        'src',
        'https://cdn.example/beam.png',
      );
      expect(screen.getByTestId('material-image-thumb')).toHaveAttribute(
        'href',
        'https://cdn.example/beam.png',
      );
    },
  );

  it('renders lines without an image as the name alone', () => {
    render(
      <PoLineItemsTab
        lineItems={[
          makeLine({ imageUrl: null }),
          // A manual-name line: no catalogue material, name lives in description.
          makeLine({
            id: 'li-2',
            materialId: null,
            materialName: null,
            description: 'Site sundries',
          }),
        ]}
      />,
    );
    expect(screen.getByText('Aluminum Beam 6061')).toBeInTheDocument();
    expect(screen.getByText('Site sundries')).toBeInTheDocument();
    expect(screen.queryByTestId('material-image-thumb')).not.toBeInTheDocument();
  });
});
