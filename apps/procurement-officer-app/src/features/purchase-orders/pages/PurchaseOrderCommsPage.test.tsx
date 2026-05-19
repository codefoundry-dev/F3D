const mockSetSearchParams = vi.hoisted(() => vi.fn());
const mockPoData = vi.hoisted(() => ({
  value: {
    data: {
      id: 'po-1',
      poNumber: 'PO-001',
    },
    isLoading: false,
    isError: false,
  } as Record<string, unknown>,
}));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'po-1' }),
  useSearchParams: () => [new URLSearchParams('tab=messages'), mockSetSearchParams],
}));

vi.mock('@forethread/po-shared', () => ({
  CreatePoWizard: (_props: any) => <div data-testid="create-po-wizard" />,
  usePurchaseOrder: () => mockPoData.value,
  PoCommsPage: ({
    po,
    initialTab,
    onTabChange,
  }: {
    po: { poNumber: string };
    initialTab: string;
    onTabChange: (tab: string) => void;
  }) => (
    <div data-testid="comms-page">
      <span>{po.poNumber}</span>
      <span>{initialTab}</span>
      <button onClick={() => onTabChange('lineItems')}>change-tab</button>
    </div>
  ),
}));

vi.mock('@forethread/rfq-shared', () => ({
  usePageTitleStore: (sel: (s: { setTitle: () => void }) => unknown) => sel({ setTitle: vi.fn() }),
}));

vi.mock('@forethread/ui-components', () => ({
  Spinner: () => <div data-testid="spinner" />,
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
}));

import { render, screen, fireEvent } from '@testing-library/react';

import PurchaseOrderCommsPage from './PurchaseOrderCommsPage';

describe('PurchaseOrderCommsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPoData.value = {
      data: { id: 'po-1', poNumber: 'PO-001' },
      isLoading: false,
      isError: false,
    };
  });

  it('shows spinner when loading', () => {
    mockPoData.value.isLoading = true;
    render(<PurchaseOrderCommsPage />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('shows error message on error', () => {
    mockPoData.value.isError = true;
    mockPoData.value.data = null;
    render(<PurchaseOrderCommsPage />);
    expect(screen.getByText('detail.noData')).toBeInTheDocument();
  });

  it('renders comms page with data', () => {
    render(<PurchaseOrderCommsPage />);
    expect(screen.getByTestId('comms-page')).toBeInTheDocument();
    expect(screen.getByText('PO-001')).toBeInTheDocument();
    expect(screen.getByText('messages')).toBeInTheDocument();
  });

  it('calls setSearchParams on tab change', () => {
    render(<PurchaseOrderCommsPage />);
    fireEvent.click(screen.getByText('change-tab'));
    expect(mockSetSearchParams).toHaveBeenCalledWith({ tab: 'lineItems' }, { replace: true });
  });
});
