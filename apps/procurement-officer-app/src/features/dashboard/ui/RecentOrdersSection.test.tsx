const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@forethread/ui-components', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => (
    <span data-testid="badge">{children}</span>
  ),
  formatStatus: (status: string | null | undefined) => {
    if (!status) return '-';
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase().replace(/_/g, ' ');
  },
  formatCurrency: (v: number | null | undefined) =>
    v === null || v === undefined
      ? '-'
      : `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
  formatDate: (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  },
  getStatusColor: () => 'text-green-500',
  MessageBadgeIcon: () => <span data-testid="message-badge" />,
  ORDER_STATUS_COLORS: {},
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
}));

import { render, screen, fireEvent } from '@testing-library/react';

import { RecentOrdersSection } from './RecentOrdersSection';

const mockItems = [
  {
    id: 'aaaa-bbbb-cccc-dddd',
    type: 'rfq',
    status: 'OPEN',
    projectName: 'Test Project',
    location: 'NYC',
    vendorName: 'Test Vendor',
    dateRange: '2025-01-01',
    itemCount: 3,
    totalCost: 5000,
    remainingPercent: 50,
  },
  {
    id: 'eeee-ffff-1111-2222',
    type: 'po',
    status: 'CLOSED',
    projectName: 'Another Project',
    location: null,
    vendorName: null,
    dateRange: null,
    itemCount: 0,
    totalCost: null,
    remainingPercent: null,
  },
];

describe('RecentOrdersSection', () => {
  beforeEach(() => mockNavigate.mockClear());

  it('shows skeleton when loading', () => {
    const { container } = render(<RecentOrdersSection items={[]} isLoading />);
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(3);
  });

  it('shows empty message', () => {
    render(<RecentOrdersSection items={[]} />);
    expect(screen.getByText('recentOrders.noOrders')).toBeInTheDocument();
  });

  it('renders order cards', () => {
    render(<RecentOrdersSection items={mockItems as never[]} />);
    expect(screen.getByText('RFQ-aaaa-bbb')).toBeInTheDocument();
    expect(screen.getByText('PO-eeee-fff')).toBeInTheDocument();
    expect(screen.getByText('Test Project')).toBeInTheDocument();
    expect(screen.getByText('NYC')).toBeInTheDocument();
    expect(screen.getByText('Test Vendor')).toBeInTheDocument();
    expect(screen.getByText('3 items')).toBeInTheDocument();
    expect(screen.getByText('$5,000.00')).toBeInTheDocument();
    expect(screen.getByText('Remaining quantity 50%')).toBeInTheDocument();
  });

  it('navigates on card click', () => {
    render(<RecentOrdersSection items={mockItems as never[]} />);
    const cards = screen.getAllByRole('button');
    fireEvent.click(cards[0]);
    expect(mockNavigate).toHaveBeenCalledWith('/rfqs/aaaa-bbbb-cccc-dddd');
  });

  it('navigates on keyboard enter', () => {
    render(<RecentOrdersSection items={mockItems as never[]} />);
    const cards = screen.getAllByRole('button');
    fireEvent.keyDown(cards[0], { key: 'Enter' });
    expect(mockNavigate).toHaveBeenCalledWith('/rfqs/aaaa-bbbb-cccc-dddd');
  });
});
