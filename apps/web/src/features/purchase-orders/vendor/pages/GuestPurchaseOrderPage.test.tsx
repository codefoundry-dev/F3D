import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';

const mockQueryResult = vi.hoisted(() => ({
  value: {
    data: null as Record<string, unknown> | null,
    isLoading: false,
    isError: false,
    error: null as unknown,
  },
}));

// The page's second query — the PO's change requests (guest-po-crs key).
const mockCrsResult = vi.hoisted(() => ({
  value: { data: [] as Record<string, unknown>[] },
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
  useNavigate: () => vi.fn(),
}));

vi.mock('@forethread/api-client', () => ({
  getPublicPurchaseOrder: vi.fn(),
  exportPublicPurchaseOrder: (...args: unknown[]) => mockExportPublicPo.value(...args),
  isApiError: (...args: unknown[]) => mockIsApiError.value(...args),
  proposePublicPoChange: vi.fn(),
  listPublicPoChangeRequests: vi.fn(() => Promise.resolve([])),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: (opts: { queryKey: unknown[] }) =>
    opts.queryKey[0] === 'guest-po-crs' ? mockCrsResult.value : mockQueryResult.value,
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock('@forethread/po-shared', () => ({
  PoDetailTabs: ({ tabs, onTabChange }: { tabs: string[]; onTabChange: (t: string) => void }) => (
    <div data-testid="po-tabs">
      {tabs.join(',')}
      {tabs.map((tab) => (
        <button key={tab} data-testid={`tab-${tab}`} onClick={() => onTabChange(tab)} />
      ))}
    </div>
  ),
  PoDetailsTab: () => <div data-testid="po-details-tab" />,
  PoLineItemsTab: () => <div data-testid="po-line-items-tab" />,
  PoCancelRequestModal: () => <div data-testid="po-cancel-request-modal" />,
  PoChangeRequestTab: ({ readOnly }: { readOnly?: boolean }) => (
    <div data-testid="po-change-request-tab" data-readonly={String(readOnly ?? false)} />
  ),
}));

vi.mock('@forethread/ui-components', () => ({
  // B7 (FOR-373): desktop layout in tests; PageActions renders its actions inline.
  useIsPhone: () => false,
  useHideMobileNav: () => {},
  MobileActionBar: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PageActions: ({
    primary,
    secondary = [],
  }: {
    primary?: React.ReactNode;
    secondary?: Array<{
      key: string;
      label: string;
      onClick: () => void;
      disabled?: boolean;
      testId?: string;
    }>;
  }) => (
    <div>
      {secondary.map((a) => (
        <button
          key={a.key}
          type="button"
          onClick={a.onClick}
          disabled={a.disabled}
          data-testid={a.testId}
        >
          {a.label}
        </button>
      ))}
      {primary}
    </div>
  ),
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
  notificationService: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@forethread/ui-components/assets/icons/download.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/info.svg?react', () => ({
  default: () => <span />,
}));

vi.mock('../components/PoVendorActions', () => ({
  PoVendorActions: ({ po, token }: { po: { status: string }; token?: string }) => (
    <div data-testid="po-vendor-actions" data-status={po.status} data-token={token ?? ''} />
  ),
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
    mockCrsResult.value = { data: [] };
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

  it('renders the token-driven action band for an actionable (SENT) PO (FOR-247)', () => {
    mockQueryResult.value = { data: samplePo, isLoading: false, isError: false, error: null };
    render(<GuestPurchaseOrderPage />);
    const actions = screen.getByTestId('po-vendor-actions');
    expect(actions).toHaveAttribute('data-token', 'po-token-123');
    expect(actions).toHaveAttribute('data-status', 'SENT');
    // The read-only banner is replaced by the action band while actionable.
    expect(screen.queryByText('guest.infoBanner')).not.toBeInTheDocument();
  });

  it('shows the read-only banner (no actions) for a terminal PO status', () => {
    mockQueryResult.value = {
      data: { ...samplePo, status: 'ACCEPTED' },
      isLoading: false,
      isError: false,
      error: null,
    };
    render(<GuestPurchaseOrderPage />);
    expect(screen.queryByTestId('po-vendor-actions')).not.toBeInTheDocument();
    expect(screen.getByText('guest.infoBanner')).toBeInTheDocument();
  });

  it('surfaces a pending change request as a read-only tab', () => {
    mockQueryResult.value = { data: samplePo, isLoading: false, isError: false, error: null };
    mockCrsResult.value = {
      data: [
        { id: 'cr-old', status: 'REJECTED' },
        { id: 'cr-1', status: 'PENDING', changedFields: {} },
      ],
    };
    render(<GuestPurchaseOrderPage />);
    expect(screen.getByTestId('po-tabs')).toHaveTextContent('details,changeRequest,lineItems');
  });

  it('renders the pending change request read-only when its tab is opened', () => {
    mockQueryResult.value = { data: samplePo, isLoading: false, isError: false, error: null };
    mockCrsResult.value = { data: [{ id: 'cr-1', status: 'PENDING', changedFields: {} }] };
    render(<GuestPurchaseOrderPage />);
    fireEvent.click(screen.getByTestId('tab-changeRequest'));
    const crTab = screen.getByTestId('po-change-request-tab');
    expect(crTab).toHaveAttribute('data-readonly', 'true');
  });

  it('keeps the change-request tab hidden when no pending CR exists', () => {
    mockQueryResult.value = { data: samplePo, isLoading: false, isError: false, error: null };
    mockCrsResult.value = { data: [{ id: 'cr-old', status: 'APPROVED' }] };
    render(<GuestPurchaseOrderPage />);
    expect(screen.getByTestId('po-tabs')).toHaveTextContent('details,lineItems');
    expect(screen.queryByTestId('po-change-request-tab')).not.toBeInTheDocument();
  });
});
