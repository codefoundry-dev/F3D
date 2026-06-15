import type { PoDetail } from '@forethread/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

const mockReceive = vi.hoisted(() => vi.fn((_id: string, _input: unknown) => Promise.resolve({})));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));

vi.mock('@forethread/api-client', () => ({
  receivePurchaseOrder: (id: string, input: unknown) => mockReceive(id, input),
}));

vi.mock('@forethread/ui-components', () => ({
  Modal: ({ children }: { children: ReactNode }) => <div data-testid="modal">{children}</div>,
  ModalHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ModalBody: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ModalFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Input: ({
    value,
    onChange,
    type,
    'aria-label': ariaLabel,
  }: {
    value: string;
    onChange: (e: { target: { value: string } }) => void;
    type?: string;
    'aria-label'?: string;
  }) => (
    <input
      type={type}
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange({ target: { value: e.target.value } })}
    />
  ),
  Button: ({
    children,
    onClick,
    disabled,
    isLoading,
  }: {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    isLoading?: boolean;
  }) => (
    <button onClick={onClick} disabled={disabled} data-loading={isLoading}>
      {children}
    </button>
  ),
}));

import { ReceiveDeliveryModal } from './ReceiveDeliveryModal';

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function makePo(overrides: Partial<PoDetail> = {}): PoDetail {
  return {
    id: 'po-1',
    status: 'ACKNOWLEDGED',
    lineItems: [
      {
        id: 'li-1',
        lineNumber: 1,
        materialName: 'Steel Beam',
        description: null,
        quantityOrdered: 10,
        quantityDelivered: 2,
        unitOfMeasure: 'EA',
        unitPrice: 100,
        lineTotal: 1000,
      },
      {
        id: 'li-2',
        lineNumber: 2,
        materialName: 'Concrete Mix',
        description: null,
        quantityOrdered: 5,
        quantityDelivered: 0,
        unitOfMeasure: 'BAG',
        unitPrice: 20,
        lineTotal: 100,
      },
    ],
    ...overrides,
  } as PoDetail;
}

describe('ReceiveDeliveryModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders a row per line item with the names', () => {
    render(<ReceiveDeliveryModal po={makePo()} onClose={vi.fn()} />, { wrapper });
    expect(screen.getByText('Steel Beam')).toBeInTheDocument();
    expect(screen.getByText('Concrete Mix')).toBeInTheDocument();
    expect(screen.getAllByRole('spinbutton')).toHaveLength(2);
  });

  it('pre-fills inputs with the current delivered quantity', () => {
    render(<ReceiveDeliveryModal po={makePo()} onClose={vi.fn()} />, { wrapper });
    const steel = screen.getByLabelText<HTMLInputElement>('Received quantity for Steel Beam');
    expect(steel.value).toBe('2');
  });

  it('disables submit when a quantity exceeds the ordered amount', () => {
    render(<ReceiveDeliveryModal po={makePo()} onClose={vi.fn()} />, { wrapper });
    const steel = screen.getByLabelText('Received quantity for Steel Beam');
    fireEvent.change(steel, { target: { value: '11' } }); // ordered = 10
    const submit = screen.getByRole('button', { name: 'Record delivery' });
    expect(submit).toBeDisabled();
  });

  it('disables submit when a quantity is below the already-delivered amount', () => {
    render(<ReceiveDeliveryModal po={makePo()} onClose={vi.fn()} />, { wrapper });
    const steel = screen.getByLabelText('Received quantity for Steel Beam');
    fireEvent.change(steel, { target: { value: '1' } }); // already delivered = 2
    expect(screen.getByRole('button', { name: 'Record delivery' })).toBeDisabled();
  });

  it('disables submit for a non-integer quantity', () => {
    render(<ReceiveDeliveryModal po={makePo()} onClose={vi.fn()} />, { wrapper });
    const steel = screen.getByLabelText('Received quantity for Steel Beam');
    fireEvent.change(steel, { target: { value: '3.5' } });
    expect(screen.getByRole('button', { name: 'Record delivery' })).toBeDisabled();
  });

  it('submits the cumulative lines payload on valid input', async () => {
    const onReceived = vi.fn();
    const onClose = vi.fn();
    render(<ReceiveDeliveryModal po={makePo()} onClose={onClose} onReceived={onReceived} />, {
      wrapper,
    });

    fireEvent.change(screen.getByLabelText('Received quantity for Steel Beam'), {
      target: { value: '6' },
    });
    fireEvent.change(screen.getByLabelText('Received quantity for Concrete Mix'), {
      target: { value: '5' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Record delivery' }));

    await waitFor(() =>
      expect(mockReceive).toHaveBeenCalledWith('po-1', {
        lines: [
          { lineItemId: 'li-1', quantityDelivered: 6 },
          { lineItemId: 'li-2', quantityDelivered: 5 },
        ],
      }),
    );
    await waitFor(() => expect(onReceived).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });
});
