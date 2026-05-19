import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

const mockDashboardData = vi.hoisted(() => ({
  value: {
    quoteResponses: [] as Record<string, unknown>[],
    recentOrders: [] as Record<string, unknown>[],
    pendingPurchaseOrders: [] as Record<string, unknown>[],
    invoicesPendingApproval: [] as Record<string, unknown>[],
    projectSuggestions: [] as { id: string; name: string }[],
    isLoading: false,
    error: null as Error | null,
  },
}));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('../hooks/useDashboardData', () => ({
  useDashboardData: () => mockDashboardData.value,
}));

// Mock SVG imports
vi.mock('@forethread/ui-components/assets/icons/upload.svg?react', () => ({
  default: () => <span data-testid="upload-icon" />,
}));
vi.mock('@forethread/ui-components/assets/icons/purchase-orders.svg?react', () => ({
  default: () => <span data-testid="po-icon" />,
}));
vi.mock('@forethread/ui-components/assets/icons/vendors.svg?react', () => ({
  default: () => <span data-testid="vendors-icon" />,
}));
vi.mock('@forethread/ui-components/assets/icons/search.svg?react', () => ({
  default: () => <span data-testid="search-icon" />,
}));

vi.mock('@forethread/po-shared', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    SelectRfqModal: () => null,
    SelectBulkOrderModal: () => null,
  };
});

vi.mock('@forethread/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@forethread/api-client')>();
  return {
    ...actual,
    approveInvoice: vi.fn(),
    rejectInvoice: vi.fn(),
    approvePurchaseOrder: vi.fn(),
    declinePurchaseOrder: vi.fn(),
    approveQuote: vi.fn(),
    declineQuote: vi.fn(),
  };
});

import DashboardPage from './DashboardPage';

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('DashboardPage', () => {
  beforeEach(() => {
    mockDashboardData.value = {
      quoteResponses: [] as Record<string, unknown>[],
      recentOrders: [] as Record<string, unknown>[],
      pendingPurchaseOrders: [] as Record<string, unknown>[],
      invoicesPendingApproval: [] as Record<string, unknown>[],
      projectSuggestions: [] as { id: string; name: string }[],
      isLoading: false,
      error: null,
    };
  });

  it('renders quick action buttons', () => {
    render(<DashboardPage />, { wrapper });
    expect(screen.getByText('quickActions.uploadInvoice')).toBeInTheDocument();
    expect(screen.getByText('quickActions.createPo')).toBeInTheDocument();
    expect(screen.getByText('quickActions.addVendor')).toBeInTheDocument();
    expect(screen.getByText('quickActions.createRfq')).toBeInTheDocument();
  });

  it('renders all section headers', () => {
    render(<DashboardPage />, { wrapper });
    expect(screen.getByText('quoteResponses.title')).toBeInTheDocument();
    expect(screen.getByText('recentOrders.title')).toBeInTheDocument();
    expect(screen.getByText('purchaseOrders.title')).toBeInTheDocument();
    expect(screen.getByText('invoicesPendingApproval.title')).toBeInTheDocument();
  });

  it('shows empty states when no data', () => {
    render(<DashboardPage />, { wrapper });
    expect(screen.getByText('quoteResponses.noResponses')).toBeInTheDocument();
    expect(screen.getByText('recentOrders.noOrders')).toBeInTheDocument();
    expect(screen.getByText('purchaseOrders.noPOs')).toBeInTheDocument();
    expect(screen.getByText('invoicesPendingApproval.noInvoices')).toBeInTheDocument();
  });

  it('renders loading skeletons when loading', () => {
    mockDashboardData.value = {
      ...mockDashboardData.value,
      isLoading: true,
    };
    const { container } = render(<DashboardPage />, { wrapper });
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders quote response cards when data is present', () => {
    mockDashboardData.value = {
      ...mockDashboardData.value,
      quoteResponses: [
        {
          id: '1',
          vendorName: 'Acme Corp',
          vendorCountry: 'US',
          rfqId: 'rfq-1',
          rfqNumber: 'RFQ-001',
          projectName: 'Project Alpha',
          dateRange: '2026-01-01 - 2026-02-01',
          totalCost: 5000,
          discountPercent: 10,
          discountAmount: 500,
          itemsCovered: 5,
          totalItems: 5,
          status: 'received',
        },
      ],
    };
    render(<DashboardPage />, { wrapper });
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('RFQ-001')).toBeInTheDocument();
  });
});
