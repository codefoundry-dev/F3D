import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, string>) => opts?.defaultValue ?? key,
  }),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@forethread/ui-components', () => ({
  Spinner: ({ size }: { size: string }) => <div data-testid={`spinner-${size}`} />,
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
}));

vi.mock('@forethread/ui-components/assets/icons/checkcircle-icon.svg?react', () => ({
  default: () => <div data-testid="check-circle-icon" />,
}));
vi.mock('@forethread/ui-components/assets/icons/clock.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/cross-in-circle.svg?react', () => ({
  default: () => <div data-testid="cross-circle-icon" />,
}));
vi.mock('@forethread/ui-components/assets/icons/dashboard.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/new-user.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/note.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/settings.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/suppliers.svg?react', () => ({
  default: () => <div />,
}));

vi.mock('@/app/route-config', () => ({
  ROUTES: { users: '/users', settings: '/settings', adminPanel: '/admin-panel' },
}));

const mockDashboardData = {
  dashboard: null as ReturnType<typeof createDashboard> | null,
  dashboardLoading: false,
  recentLogs: [] as unknown[],
  auditLoading: false,
};

vi.mock('../hooks/useDashboardData', () => ({
  useDashboardData: () => mockDashboardData,
}));

vi.mock('../ui/KpiCard', () => ({
  KpiCard: ({
    title,
    value,
    statusIcon,
  }: {
    title: string;
    value: string;
    statusIcon?: React.ReactNode;
  }) => (
    <div data-testid="kpi-card">
      {title}: {value}
      {statusIcon && <span data-testid="kpi-status-icon">{statusIcon}</span>}
    </div>
  ),
}));

vi.mock('../ui/PlatformStateTable', () => ({
  PlatformStateTable: () => <div data-testid="platform-state-table" />,
}));

vi.mock('../ui/RecentChangesTimeline', () => ({
  RecentChangesTimeline: () => <div data-testid="recent-changes-timeline" />,
}));

function createDashboard(overrides: Record<string, unknown> = {}) {
  return {
    users: {
      total: 50,
      active: 42,
      newThisWeek: 3,
      byRole: [
        { role: 'SUPER_ADMIN', count: 2 },
        { role: 'PROCUREMENT_OFFICER', count: 10 },
        { role: 'VENDOR', count: 0 },
      ],
    },
    companies: { total: 10, active: 8, contractors: 5, vendors: 3, newThisWeek: 1 },
    projects: { total: 5, byStatus: { ACTIVE: 3, COMPLETED: 2 } },
    procurement: { totalRfqs: 12, openRfqs: 4, totalPos: 8, totalInvoices: 6, pendingInvoices: 2 },
    system: { dbResponseMs: 15, status: 'healthy' },
    ...overrides,
  };
}

import DashboardPage from './DashboardPage';

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDashboardData.dashboard = null;
    mockDashboardData.dashboardLoading = false;
    mockDashboardData.recentLogs = [];
    mockDashboardData.auditLoading = false;
  });

  it('renders without crashing', () => {
    render(<DashboardPage />);
  });

  it('displays 4 KPI cards', () => {
    render(<DashboardPage />);
    const cards = screen.getAllByTestId('kpi-card');
    expect(cards.length).toBe(4);
  });

  it('displays quick action buttons', () => {
    render(<DashboardPage />);
    expect(screen.getByText('quickActions.userManagement')).toBeInTheDocument();
    expect(screen.getByText('quickActions.companyManagement')).toBeInTheDocument();
    expect(screen.getByText('quickActions.materialCatalogue')).toBeInTheDocument();
    expect(screen.getByText('quickActions.adminPanel')).toBeInTheDocument();
  });

  it('renders PlatformStateTable', () => {
    render(<DashboardPage />);
    expect(screen.getByTestId('platform-state-table')).toBeInTheDocument();
  });

  it('renders RecentChangesTimeline', () => {
    render(<DashboardPage />);
    expect(screen.getByTestId('recent-changes-timeline')).toBeInTheDocument();
  });

  describe('when dashboard is loading', () => {
    beforeEach(() => {
      mockDashboardData.dashboardLoading = true;
    });

    it('shows loading placeholder in KPI card values', () => {
      render(<DashboardPage />);
      const cards = screen.getAllByTestId('kpi-card');
      // All 4 cards should show "..." as value
      const ellipsisCounts = cards.filter((c) => c.textContent?.includes('...')).length;
      expect(ellipsisCounts).toBe(4);
    });
  });

  describe('when dashboard data is available (healthy)', () => {
    beforeEach(() => {
      mockDashboardData.dashboard = createDashboard();
    });

    it('shows active user count', () => {
      render(<DashboardPage />);
      expect(screen.getByText(/42/)).toBeInTheDocument();
    });

    it('shows total companies in KPI card', () => {
      render(<DashboardPage />);
      const kpiCards = screen.getAllByTestId('kpi-card');
      const companiesCard = kpiCards.find((card) =>
        card.textContent?.includes('kpi.totalCompanies'),
      );
      expect(companiesCard).toBeDefined();
      expect(companiesCard?.textContent).toContain('10');
    });

    it('shows db response time', () => {
      render(<DashboardPage />);
      expect(screen.getByText(/15 ms/)).toBeInTheDocument();
    });

    it('renders overview stat cards with project/RFQ/PO/invoice data', () => {
      render(<DashboardPage />);
      expect(screen.getByText('Projects')).toBeInTheDocument();
      expect(screen.getByText('RFQs')).toBeInTheDocument();
      expect(screen.getByText('Purchase Orders')).toBeInTheDocument();
      expect(screen.getByText('Invoices')).toBeInTheDocument();
    });

    it('renders project breakdown by status', () => {
      render(<DashboardPage />);
      expect(screen.getByText('active')).toBeInTheDocument();
      expect(screen.getByText('completed')).toBeInTheDocument();
    });

    it('renders users by role section, filtering out zero-count roles', () => {
      render(<DashboardPage />);
      expect(screen.getByText('Users by Role')).toBeInTheDocument();
      expect(screen.getByText('super admin')).toBeInTheDocument();
      expect(screen.getByText('procurement officer')).toBeInTheDocument();
      // VENDOR has count 0, should be filtered out
      expect(screen.queryByText('vendor')).not.toBeInTheDocument();
    });
  });

  describe('when system is degraded', () => {
    beforeEach(() => {
      mockDashboardData.dashboard = createDashboard({
        system: { dbResponseMs: 500, status: 'degraded' },
      });
    });

    it('shows degraded status text', () => {
      render(<DashboardPage />);
      expect(screen.getByText(/Degraded/)).toBeInTheDocument();
    });
  });

  describe('when dashboard is null (no data)', () => {
    it('does not render overview stat cards', () => {
      render(<DashboardPage />);
      expect(screen.queryByText('Projects')).not.toBeInTheDocument();
    });

    it('does not render users by role section', () => {
      render(<DashboardPage />);
      expect(screen.queryByText('Users by Role')).not.toBeInTheDocument();
    });
  });

  describe('quick action navigation', () => {
    it('navigates to users page on User Management click', () => {
      render(<DashboardPage />);

      fireEvent.click(screen.getByText('quickActions.userManagement'));
      expect(mockNavigate).toHaveBeenCalledWith('/users');
    });

    it('navigates to admin panel on Admin Panel click', () => {
      render(<DashboardPage />);

      fireEvent.click(screen.getByText('quickActions.adminPanel'));
      expect(mockNavigate).toHaveBeenCalledWith('/admin-panel');
    });

    it('Material Catalogue button is disabled', () => {
      render(<DashboardPage />);
      const btn = screen.getByText('quickActions.materialCatalogue').closest('button');
      expect(btn).toBeDisabled();
    });
  });
});
