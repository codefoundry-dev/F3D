import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

const mockDashboardData = vi.hoisted(() => ({
  value: {
    quoteResponses: [],
    recentOrders: [],
    pendingPurchaseOrders: [],
    invoicesPendingApproval: [],
    projectSuggestions: [],
    isLoading: false,
    error: null,
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

vi.mock('@forethread/ui-components/assets/icons/upload.svg?react', () => ({
  default: () => <span data-testid="upload-icon" />,
}));
vi.mock('@forethread/ui-components/assets/icons/purchase-orders.svg?react', () => ({
  default: () => <span data-testid="po-icon" />,
}));
vi.mock('@forethread/ui-components/assets/icons/report.svg?react', () => ({
  default: () => <span data-testid="report-icon" />,
}));
vi.mock('@forethread/ui-components/assets/icons/search.svg?react', () => ({
  default: () => <span data-testid="search-icon" />,
}));

import DashboardPage from './DashboardPage';

vi.mock('@forethread/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@forethread/api-client')>();
  return {
    ...actual,
    approveInvoice: vi.fn(),
    rejectInvoice: vi.fn(),
    approvePurchaseOrder: vi.fn(),
    declinePurchaseOrder: vi.fn(),
    approveQuoteResponse: vi.fn(),
    declineQuoteResponse: vi.fn(),
  };
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('ProcurementOfficer DashboardPage', () => {
  beforeEach(() => {
    mockDashboardData.value = {
      quoteResponses: [],
      recentOrders: [],
      pendingPurchaseOrders: [],
      invoicesPendingApproval: [],
      projectSuggestions: [],
      isLoading: false,
      error: null,
    };
  });

  it('renders quick action buttons', () => {
    render(<DashboardPage />, { wrapper });
    expect(screen.getByText('quickActions.uploadInvoice')).toBeInTheDocument();
    expect(screen.getByText('quickActions.createPo')).toBeInTheDocument();
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
});
