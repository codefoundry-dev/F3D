import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';

const mockDashboardData = vi.hoisted(() => ({
  value: {
    totalPendingAmount: 0,
    pendingInvoiceCount: 0,
    invoicesDueThisWeek: 0,
    invoicesDueAmount: 0,
    disputedInvoiceCount: 0,
    disputedTrend: 0,
    invoicesPendingApproval: [],
    disputedInvoices: [],
    isLoading: false,
    error: null,
  },
}));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../hooks/useDashboardData', () => ({
  useDashboardData: () => mockDashboardData.value,
}));

vi.mock('@forethread/ui-components/assets/icons/upload.svg?react', () => ({
  default: () => <span data-testid="upload-icon" />,
}));

vi.mock('@forethread/ui-components/assets/icons/arrow-down.svg?react', () => ({
  default: () => <span data-testid="arrow-icon" />,
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

import DashboardPage from './DashboardPage';

vi.mock('@forethread/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@forethread/api-client')>();
  return { ...actual, approveInvoice: vi.fn(), rejectInvoice: vi.fn() };
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('Finance DashboardPage', () => {
  beforeEach(() => {
    mockDashboardData.value = {
      totalPendingAmount: 0,
      pendingInvoiceCount: 0,
      invoicesDueThisWeek: 0,
      invoicesDueAmount: 0,
      disputedInvoiceCount: 0,
      disputedTrend: 0,
      invoicesPendingApproval: [],
      disputedInvoices: [],
      isLoading: false,
      error: null,
    };
  });

  it('renders upload invoice button', () => {
    render(<DashboardPage />, { wrapper });
    expect(screen.getByText('finance.uploadInvoice')).toBeInTheDocument();
  });

  it('renders KPI card labels', () => {
    render(<DashboardPage />, { wrapper });
    expect(screen.getByText('finance.totalPendingAmount')).toBeInTheDocument();
    expect(screen.getByText('finance.invoicesDueThisWeek')).toBeInTheDocument();
    expect(screen.getByText('finance.disputedInvoices')).toBeInTheDocument();
  });

  it('renders section headers', () => {
    render(<DashboardPage />, { wrapper });
    expect(screen.getByText('finance.invoicesPending.title')).toBeInTheDocument();
    expect(screen.getByText('finance.disputed.title')).toBeInTheDocument();
  });

  it('shows empty states when no data', () => {
    render(<DashboardPage />, { wrapper });
    expect(screen.getByText('finance.invoicesPending.noInvoices')).toBeInTheDocument();
    expect(screen.getByText('finance.disputed.noInvoices')).toBeInTheDocument();
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

  it('renders KPI values when data is present', () => {
    mockDashboardData.value = {
      ...mockDashboardData.value,
      totalPendingAmount: 50000,
      pendingInvoiceCount: 12,
      invoicesDueThisWeek: 5,
      invoicesDueAmount: 15000,
      disputedInvoiceCount: 3,
      disputedTrend: 2,
    };
    render(<DashboardPage />, { wrapper });
    expect(screen.getByText('$50,000.00')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('navigates to invoices on upload button click', () => {
    render(<DashboardPage />, { wrapper });
    fireEvent.click(screen.getByText('finance.uploadInvoice'));
    expect(mockNavigate).toHaveBeenCalledWith('/invoices');
  });
});
