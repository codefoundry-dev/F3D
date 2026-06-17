/* eslint-disable @typescript-eslint/no-explicit-any */
const mockMutate = vi.hoisted(() => vi.fn());
const mockNavigate = vi.hoisted(() => vi.fn());
const mockSetTitle = vi.hoisted(() => vi.fn());
const mockSuccess = vi.hoisted(() => vi.fn());
const mockError = vi.hoisted(() => vi.fn());

// Toggle the selected RFQ detail in/out to drive empty vs populated state.
const state = vi.hoisted(() => ({ hasDetail: false }));

const APPROVED_RFQ_DETAIL = vi.hoisted(() => ({
  id: 'rfq-1',
  name: 'Alpha RFQ',
  rfqNumber: 'RFQ-001',
  projectName: 'Alpha Project',
  projectId: 'proj-1',
  lineItems: [
    {
      id: 'li-1',
      projectName: 'Alpha Project',
      materialName: 'Steel Beam',
      description: '12ft',
      quantity: 10,
      unit: 'pcs',
      expectedDeliveryDate: null,
      deliveryLocation: null,
    },
  ],
  quoteResponses: [
    {
      id: 'qr-1',
      vendorId: 'vendor-9',
      vendorName: 'Vendor A',
      totalCost: 1000,
      discountPercent: 5,
      discountAmount: 50,
      status: 'APPROVED',
      submittedAt: null,
    },
  ],
}));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/rfq-shared', () => ({
  usePageTitleStore: (selector: any) => selector({ setTitle: mockSetTitle }),
}));

vi.mock('@forethread/api-client', () => ({
  getRfqs: vi.fn(),
  getRfq: vi.fn(),
}));

vi.mock('../services/bulk-orders.service', () => ({
  useCreateBulkOrder: () => ({ mutate: mockMutate, isPending: false }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: any) => {
    // The RFQ list query.
    if (queryKey[1] === 'approved-quotes') {
      return {
        data: { items: [{ id: 'rfq-1', rfqNumber: 'RFQ-001', projectName: 'Alpha Project' }] },
        isLoading: false,
      };
    }
    // The selected RFQ detail query.
    return { data: state.hasDetail ? APPROVED_RFQ_DETAIL : undefined, isLoading: false };
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@forethread/ui-components', () => ({
  Alert: ({ children }: any) => <div data-testid="alert">{children}</div>,
  Button: ({ children, onClick, disabled }: any) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  CustomDropdown: ({ value, onChange, options, disabled }: any) => (
    <select
      data-testid="dropdown"
      value={value}
      disabled={disabled}
      onChange={(e: any) => onChange?.(e.target.value)}
    >
      <option value="">empty</option>
      {options.map((o: any) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
  DatePicker: ({ value, onChange }: any) => (
    <input data-testid="date" value={value} onChange={(e: any) => onChange(e.target.value)} />
  ),
  FormField: ({ label, children }: any) => (
    <label>
      {label}
      {children}
    </label>
  ),
  Spinner: () => <span data-testid="spinner" />,
  formatCurrency: (n: number) => `$${n}`,
  notificationService: { success: mockSuccess, error: mockError },
}));

vi.mock('@forethread/ui-components/assets/icons/cross.svg?react', () => ({
  default: () => <span data-testid="cross-icon" />,
}));
vi.mock('@forethread/ui-components/assets/icons/edit-in-square.svg?react', () => ({
  default: () => <span data-testid="edit-icon" />,
}));
vi.mock('@forethread/ui-components/assets/icons/info.svg?react', () => ({
  default: () => <span data-testid="info-icon" />,
}));

import { fireEvent, render, screen } from '@testing-library/react';

import { CreateBulkOrderPage } from './CreateBulkOrderPage';

beforeEach(() => {
  mockMutate.mockReset();
  mockNavigate.mockReset();
  state.hasDetail = false;
});

describe('CreateBulkOrderPage', () => {
  it('sets the page title on mount', () => {
    render(<CreateBulkOrderPage />);
    expect(mockSetTitle).toHaveBeenCalledWith('create.title', 'create.subtitle');
  });

  it('shows the auto-populate info banner and a disabled Create in the empty state', () => {
    render(<CreateBulkOrderPage />);
    expect(screen.getByText('create.autoPopulateInfo')).toBeInTheDocument();
    expect(screen.getByText('create.bulkDetails')).toBeInTheDocument();
    expect(screen.getByText('create.create')).toBeDisabled();
  });

  it('renders the read-only line items once an approved response is selected', () => {
    state.hasDetail = true;
    render(<CreateBulkOrderPage />);
    expect(screen.getByText('create.projectDetails')).toBeInTheDocument();
    expect(screen.getByText('Steel Beam')).toBeInTheDocument();
    expect(screen.getByText('create.summary.totalWithTaxes')).toBeInTheDocument();
  });

  it('submits createBulkOrder with derived vendor + line items and navigates to the new detail', () => {
    state.hasDetail = true;
    mockMutate.mockImplementation((_payload: any, opts: any) =>
      opts.onSuccess({ id: 'bo-99', bulkId: 'BULK-099' }),
    );

    render(<CreateBulkOrderPage />);
    fireEvent.change(screen.getByTestId('date'), { target: { value: '2025-12-31' } });
    fireEvent.click(screen.getByText('create.create'));

    expect(mockMutate).toHaveBeenCalledTimes(1);
    const payload = mockMutate.mock.calls[0][0];
    expect(payload).toMatchObject({
      projectId: 'proj-1',
      vendorId: 'vendor-9',
      rfqId: 'rfq-1',
      endDate: '2025-12-31',
    });
    expect(payload.lineItems[0]).toMatchObject({
      itemReference: 'Steel Beam',
      qty: 10,
      unit: 'pcs',
      pricePerUnit: 100,
    });
    expect(mockNavigate).toHaveBeenCalledWith('/bulk-orders/bo-99');
  });

  it('navigates back to the list when Cancel is clicked', () => {
    render(<CreateBulkOrderPage />);
    fireEvent.click(screen.getByText('create.cancel'));
    expect(mockNavigate).toHaveBeenCalledWith('/bulk-orders');
  });
});
