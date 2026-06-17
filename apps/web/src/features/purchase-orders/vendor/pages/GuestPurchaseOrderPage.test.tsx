import { fireEvent, render, screen } from '@testing-library/react';

const mockQueryResult = vi.hoisted(() => ({
  value: {
    data: null as Record<string, unknown> | null,
    isLoading: false,
    isError: false,
    error: null as unknown,
  },
}));

const mockIsApiError = vi.hoisted(() => ({ value: vi.fn((..._args: unknown[]) => false) }));
const mockExportPublicPo = vi.hoisted(() => ({
  value: vi.fn((..._args: unknown[]) => Promise.resolve({ url: 'u' })),
}));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ token: 'po-token-123' }),
}));

vi.mock('@forethread/api-client', () => ({
  getPublicPurchaseOrder: vi.fn(),
  exportPublicPurchaseOrder: (...args: unknown[]) => mockExportPublicPo.value(...args),
  isApiError: (...args: unknown[]) => mockIsApiError.value(...args),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => mockQueryResult.value,
}));

vi.mock('@forethread/po-shared', () => ({
  PoDetailTabs: ({ tabs }: { tabs: string[] }) => <div data-testid="po-tabs">{tabs.join(',')}</div>,
  PoDetailsTab: () => <div data-testid="po-details-tab" />,
  PoLineItemsTab: () => <div data-testid="po-line-items-tab" />,
}));

vi.mock('@forethread/ui-components', () => ({
  Alert: ({ children }: { children: React.ReactNode }) => <div data-testid="alert">{children}</div>,
  Badge: ({ children }: { children: React.ReactNode }) => (
    <span data-testid="badge">{children}</span>
  ),
  Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
  Spinner: ({ size }: { size?: string }) => <div data-testid="spinner" data-size={size} />,
  getStatusColor: () => '',
  PO_STATUS_COLORS: {},
}));

vi.mock('@forethread/ui-components/assets/icons/download.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/info.svg?react', () => ({
  default: () => <span />,
}));

import GuestPurchaseOrderPage from './GuestPurchaseOrderPage';

const samplePo = {
  id: 'po-1',
  poNumber: 'PO-001',
  status: 'SENT',
  company: { id: 'c-1', name: 'Contractor Corp' },
  vendor: { id: 'v-1', name: 'Vendor Inc' },
  lineItems: [],
};

describe('GuestPurchaseOrderPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryResult.value = { data: null, isLoading: false, isError: false, error: null };
    mockIsApiError.value = vi.fn((..._args: unknown[]) => false);
    mockExportPublicPo.value = vi.fn(() => Promise.resolve({ url: 'u' }));
    // jsdom has no window.open; stub it so the fire-and-forget download is quiet.
    vi.stubGlobal('open', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows a spinner while loading', () => {
    mockQueryResult.value = { data: null, isLoading: true, isError: false, error: null };
    render(<GuestPurchaseOrderPage />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('shows the expired message when the token is rejected with 403', () => {
    mockIsApiError.value = vi.fn(() => true);
    mockQueryResult.value = {
      data: null,
      isLoading: false,
      isError: true,
      error: { statusCode: 403 },
    };
    render(<GuestPurchaseOrderPage />);
    expect(screen.getByText('guest.expiredToken')).toBeInTheDocument();
    expect(screen.queryByText('guest.invalidToken')).not.toBeInTheDocument();
  });

  it('shows the invalid-link message for a non-403 error', () => {
    mockQueryResult.value = { data: null, isLoading: false, isError: true, error: null };
    render(<GuestPurchaseOrderPage />);
    expect(screen.getByText('guest.invalidToken')).toBeInTheDocument();
  });

  it('renders the read-only PO (details tab + status badge) when loaded', () => {
    mockQueryResult.value = { data: samplePo, isLoading: false, isError: false, error: null };
    render(<GuestPurchaseOrderPage />);
    expect(screen.getByText('guest.title')).toBeInTheDocument();
    expect(screen.getByTestId('po-details-tab')).toBeInTheDocument();
    // Only the read-only content tabs are exposed.
    expect(screen.getByTestId('po-tabs')).toHaveTextContent('details,lineItems');
  });

  it('downloads the PO PDF with the token when the button is clicked', () => {
    mockQueryResult.value = { data: samplePo, isLoading: false, isError: false, error: null };
    render(<GuestPurchaseOrderPage />);
    fireEvent.click(screen.getByText('guest.download'));
    expect(mockExportPublicPo.value).toHaveBeenCalledWith('po-token-123');
  });
});
