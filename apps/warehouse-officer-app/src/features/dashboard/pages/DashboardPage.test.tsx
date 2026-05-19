import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

let mockDashboardReturn = {
  data: null as Record<string, unknown> | null,
  isLoading: false,
};

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key,
  }),
}));

vi.mock('@forethread/ui-components', () => ({
  Badge: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span data-testid="badge" className={className}>
      {children}
    </span>
  ),
  PageLoader: () => <div data-testid="page-loader">Loading...</div>,
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
}));

vi.mock('@forethread/ui-components/assets/icons/location.svg?react', () => ({
  default: () => <div data-testid="location-icon" />,
}));
vi.mock('@forethread/ui-components/assets/icons/package.svg?react', () => ({
  default: () => <div data-testid="package-icon" />,
}));

vi.mock('../hooks/useDashboardData', () => ({
  useDashboardData: () => mockDashboardReturn,
}));

import DashboardPage from './DashboardPage';

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDashboardReturn = { data: null, isLoading: false };
  });

  it('shows page loader when loading', () => {
    mockDashboardReturn.isLoading = true;
    render(<DashboardPage />);
    expect(screen.getByTestId('page-loader')).toBeInTheDocument();
  });

  it('shows no data message when data is null', () => {
    mockDashboardReturn.data = null;
    render(<DashboardPage />);
    expect(screen.getByText('Unable to load dashboard data.')).toBeInTheDocument();
  });

  it('renders KPI cards with data', () => {
    mockDashboardReturn.data = {
      kpi: { pendingDeliveries: 5, overdueDeliveries: 2, delivered: 10, activeBulkOrders: 3 },
      pendingDeliveries: [],
      recentDeliveries: [],
      activeBulkOrders: [],
    };
    render(<DashboardPage />);
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders KPI titles', () => {
    mockDashboardReturn.data = {
      kpi: { pendingDeliveries: 0, overdueDeliveries: 0, delivered: 0, activeBulkOrders: 0 },
      pendingDeliveries: [],
      recentDeliveries: [],
      activeBulkOrders: [],
    };
    render(<DashboardPage />);
    expect(screen.getAllByText('Pending Deliveries').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Overdue')).toBeInTheDocument();
    expect(screen.getByText('Recently Delivered')).toBeInTheDocument();
  });

  it('shows empty text for empty delivery sections', () => {
    mockDashboardReturn.data = {
      kpi: { pendingDeliveries: 0, overdueDeliveries: 0, delivered: 0, activeBulkOrders: 0 },
      pendingDeliveries: [],
      recentDeliveries: [],
      activeBulkOrders: [],
    };
    render(<DashboardPage />);
    expect(screen.getByText('No pending deliveries.')).toBeInTheDocument();
    expect(screen.getByText('No recent deliveries.')).toBeInTheDocument();
    expect(screen.getByText('No active bulk orders.')).toBeInTheDocument();
  });

  it('renders delivery items when present', () => {
    mockDashboardReturn.data = {
      kpi: { pendingDeliveries: 1, overdueDeliveries: 0, delivered: 0, activeBulkOrders: 0 },
      pendingDeliveries: [
        {
          id: 'po-1',
          poNumber: 'PO-001',
          status: 'PENDING',
          projectName: 'Project Alpha',
          vendorName: 'Vendor X',
          requester: 'John',
          itemCount: 5,
          deliveryLocation: 'Warehouse A',
          deadlineEnd: '2026-04-01',
          totalAmount: 1500.5,
        },
      ],
      recentDeliveries: [],
      activeBulkOrders: [],
    };
    render(<DashboardPage />);
    expect(screen.getByText('PO-001')).toBeInTheDocument();
    expect(screen.getByText('Project Alpha')).toBeInTheDocument();
    expect(screen.getByText(/Vendor X/)).toBeInTheDocument();
    expect(screen.getByText('5 items')).toBeInTheDocument();
    expect(screen.getByText('Warehouse A')).toBeInTheDocument();
    expect(screen.getByText('$1,500.50')).toBeInTheDocument();
  });

  it('renders overdue delivery with destructive styling', () => {
    const pastDate = '2020-01-01';
    mockDashboardReturn.data = {
      kpi: { pendingDeliveries: 1, overdueDeliveries: 1, delivered: 0, activeBulkOrders: 0 },
      pendingDeliveries: [
        {
          id: 'po-2',
          poNumber: 'PO-002',
          status: 'OVERDUE',
          projectName: 'Project B',
          vendorName: 'Vendor Y',
          requester: null,
          itemCount: 2,
          deliveryLocation: null,
          deadlineEnd: pastDate,
          totalAmount: null,
        },
      ],
      recentDeliveries: [],
      activeBulkOrders: [],
    };
    render(<DashboardPage />);
    expect(screen.getByText('PO-002')).toBeInTheDocument();
    expect(screen.getByText('Project B')).toBeInTheDocument();
  });

  it('renders bulk orders with line items', () => {
    mockDashboardReturn.data = {
      kpi: { pendingDeliveries: 0, overdueDeliveries: 0, delivered: 0, activeBulkOrders: 1 },
      pendingDeliveries: [],
      recentDeliveries: [],
      activeBulkOrders: [
        {
          id: 'bo-1',
          projectName: 'Bulk Project',
          vendorName: 'Bulk Vendor',
          status: 'IN_PROGRESS',
          totalAmount: 5000,
          lineItems: [
            { description: 'Steel bars', qty: 100, qtyRemaining: 30, deliveriesPercent: 70 },
            { description: 'Bolts', qty: 200, qtyRemaining: 200, deliveriesPercent: 0 },
          ],
        },
      ],
    };
    render(<DashboardPage />);
    expect(screen.getByText('Bulk Project')).toBeInTheDocument();
    expect(screen.getByText('Bulk Vendor')).toBeInTheDocument();
    expect(screen.getByText('$5,000.00')).toBeInTheDocument();
    expect(screen.getByText('Steel bars')).toBeInTheDocument();
    expect(screen.getByText('70/100 (70%)')).toBeInTheDocument();
    expect(screen.getByText('Bolts')).toBeInTheDocument();
    expect(screen.getByText('0/200 (0%)')).toBeInTheDocument();
  });

  it('renders bulk order without totalAmount', () => {
    mockDashboardReturn.data = {
      kpi: { pendingDeliveries: 0, overdueDeliveries: 0, delivered: 0, activeBulkOrders: 1 },
      pendingDeliveries: [],
      recentDeliveries: [],
      activeBulkOrders: [
        {
          id: 'bo-2',
          projectName: 'No Amount Project',
          vendorName: 'V',
          status: 'OPEN',
          totalAmount: null,
          lineItems: [],
        },
      ],
    };
    render(<DashboardPage />);
    expect(screen.getByText('No Amount Project')).toBeInTheDocument();
  });

  it('applies accent class when overdue deliveries > 0', () => {
    mockDashboardReturn.data = {
      kpi: { pendingDeliveries: 3, overdueDeliveries: 1, delivered: 0, activeBulkOrders: 0 },
      pendingDeliveries: [],
      recentDeliveries: [],
      activeBulkOrders: [],
    };
    const { container } = render(<DashboardPage />);
    const destructiveElements = container.querySelectorAll('.text-destructive');
    expect(destructiveElements.length).toBeGreaterThan(0);
  });
});
