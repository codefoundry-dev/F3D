const mockNavigate = vi.hoisted(() => vi.fn());
const mockCreateMutate = vi.hoisted(() => vi.fn());
const mockUseBulkOrder = vi.hoisted(() => vi.fn());
const mockBulkOrderToFormDefaults = vi.hoisted(() => vi.fn());

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ id: 'bo-1' }),
}));

vi.mock('@forethread/bulk-order-shared', () => ({
  useBulkOrder: (id: string) => mockUseBulkOrder(id),
}));

vi.mock('@forethread/po-shared', () => ({
  bulkOrderToFormDefaults: (...args: unknown[]) => mockBulkOrderToFormDefaults(...args),
  CreatePoWizard: (props: any) => (
    <div data-testid="create-po-wizard">
      <span data-testid="creation-mode">{props.creationMode}</span>
      <span data-testid="bulk-order-id">{props.bulkOrderId}</span>
      <span data-testid="bulk-order-number">{props.bulkOrderNumber}</span>
      <span data-testid="is-creating">{String(props.isCreating)}</span>
      <button data-testid="navigate-back" onClick={props.onNavigateBack}>
        back
      </button>
      <button data-testid="on-success" onClick={props.onSuccess}>
        success
      </button>
      <button
        data-testid="on-create-po"
        onClick={() =>
          props.onCreatePo(
            { poType: 'DRAWDOWN', bulkOrderId: props.bulkOrderId },
            { onSuccess: () => {}, onError: () => {} },
          )
        }
      >
        create
      </button>
    </div>
  ),
}));

vi.mock('@forethread/ui-components', () => ({
  Spinner: () => <div data-testid="spinner" />,
  Alert: ({ children }: any) => <div data-testid="alert">{children}</div>,
}));

vi.mock('@/features/purchase-orders/buyer/services/purchase-orders.service', () => ({
  useProjectsList: () => ({
    data: { items: [{ id: 'proj-1', name: 'Project Alpha' }] },
  }),
  useProjectDetail: () => ({ data: { id: 'proj-1', currency: 'AUD', locations: [] } }),
  useCompanyVendors: () => ({
    data: [{ id: 'vend-1', legalName: 'Vendor Alpha', tradeName: null }],
  }),
  useCreatePurchaseOrder: () => ({ mutate: mockCreateMutate, isPending: false }),
}));

import { render, screen, fireEvent } from '@testing-library/react';

import BulkOrderDrawdownPage from './BulkOrderDrawdownPage';

const BULK_ORDER = {
  id: 'bo-1',
  bulkId: 'BULK-2025-011',
  projectName: 'Project Alpha',
  vendorName: 'Vendor Alpha',
  lineItems: [
    {
      lineItemId: 'li-1',
      itemReference: 'REF-1',
      description: 'Steel',
      qty: 100,
      unit: 'kg',
      ordered: 40,
      qtyRemaining: 60,
      deliveriesPercent: 0,
      pricePerUnit: 5,
      totalLineInc: 500,
    },
  ],
};

describe('BulkOrderDrawdownPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBulkOrderToFormDefaults.mockReturnValue({
      defaultValues: { vendorId: 'vend-1' },
      lockedFields: new Set(['vendorId', 'projectId']),
    });
  });

  it('shows a spinner while loading', () => {
    mockUseBulkOrder.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    render(<BulkOrderDrawdownPage />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
    expect(screen.queryByTestId('create-po-wizard')).not.toBeInTheDocument();
  });

  it('shows an error alert when the bulk order fails to load', () => {
    mockUseBulkOrder.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    render(<BulkOrderDrawdownPage />);
    expect(screen.getByTestId('alert')).toBeInTheDocument();
  });

  it('renders the wizard in from-bulk-order (drawdown) mode with bulk order context', () => {
    mockUseBulkOrder.mockReturnValue({ data: BULK_ORDER, isLoading: false, isError: false });
    render(<BulkOrderDrawdownPage />);
    expect(screen.getByTestId('creation-mode')).toHaveTextContent('from-bulk-order');
    expect(screen.getByTestId('bulk-order-id')).toHaveTextContent('bo-1');
    expect(screen.getByTestId('bulk-order-number')).toHaveTextContent('BULK-2025-011');
  });

  it('resolves project + vendor ids by name and passes them to bulkOrderToFormDefaults', () => {
    mockUseBulkOrder.mockReturnValue({ data: BULK_ORDER, isLoading: false, isError: false });
    render(<BulkOrderDrawdownPage />);
    expect(mockBulkOrderToFormDefaults).toHaveBeenCalledWith(BULK_ORDER, {
      projectId: 'proj-1',
      vendorId: 'vend-1',
    });
  });

  it('navigates to the bulk order detail on back and on success', () => {
    mockUseBulkOrder.mockReturnValue({ data: BULK_ORDER, isLoading: false, isError: false });
    render(<BulkOrderDrawdownPage />);

    fireEvent.click(screen.getByTestId('navigate-back'));
    expect(mockNavigate).toHaveBeenCalledWith('/bulk-orders/bo-1');

    mockNavigate.mockClear();
    fireEvent.click(screen.getByTestId('on-success'));
    expect(mockNavigate).toHaveBeenCalledWith('/bulk-orders/bo-1');
  });

  it('forwards the create payload (with bulkOrderId) to the create mutation', () => {
    mockUseBulkOrder.mockReturnValue({ data: BULK_ORDER, isLoading: false, isError: false });
    render(<BulkOrderDrawdownPage />);
    fireEvent.click(screen.getByTestId('on-create-po'));
    expect(mockCreateMutate).toHaveBeenCalledWith(
      { poType: 'DRAWDOWN', bulkOrderId: 'bo-1' },
      { onSuccess: expect.any(Function), onError: expect.any(Function) },
    );
  });
});
