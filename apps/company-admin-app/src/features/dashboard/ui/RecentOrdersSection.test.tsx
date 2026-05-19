import type { RecentOrderItem } from '@forethread/api-client';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/ui-components/assets/icons/coins.svg?react', () => ({
  default: () => <span data-testid="coins-icon" />,
}));
vi.mock('@forethread/ui-components/assets/icons/date.svg?react', () => ({
  default: () => <span data-testid="date-icon" />,
}));
vi.mock('@forethread/ui-components/assets/icons/eye-opened.svg?react', () => ({
  default: () => <span data-testid="eye-icon" />,
}));
vi.mock('@forethread/ui-components/assets/icons/location.svg?react', () => ({
  default: () => <span data-testid="location-icon" />,
}));
vi.mock('@forethread/ui-components/assets/icons/package.svg?react', () => ({
  default: () => <span data-testid="package-icon" />,
}));
vi.mock('@forethread/ui-components/assets/icons/projects.svg?react', () => ({
  default: () => <span data-testid="projects-icon" />,
}));
vi.mock('@forethread/ui-components/assets/icons/users-group.svg?react', () => ({
  default: () => <span data-testid="users-group-icon" />,
}));

import { RecentOrdersSection } from './RecentOrdersSection';

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

const mockItems: RecentOrderItem[] = [
  {
    id: '1',
    type: 'rfq',
    status: 'active',
    projectName: 'Project Alpha',
    vendorName: 'Acme Corp',
    location: 'New York',
    dateRange: '2026-01-01 - 2026-02-01',
    itemCount: 5,
    totalCost: 10000,
    remainingPercent: 75,
    hasMessages: false,
  },
];

describe('RecentOrdersSection', () => {
  it('renders section title', () => {
    render(<RecentOrdersSection items={[]} />, { wrapper });
    expect(screen.getByText('recentOrders.title')).toBeInTheDocument();
  });

  it('shows empty state when no items', () => {
    render(<RecentOrdersSection items={[]} />, { wrapper });
    expect(screen.getByText('recentOrders.noOrders')).toBeInTheDocument();
  });

  it('renders order cards with data', () => {
    render(<RecentOrdersSection items={mockItems} />, { wrapper });
    expect(screen.getByText('Project Alpha')).toBeInTheDocument();
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('RFQ-1')).toBeInTheDocument();
  });

  it('shows loading skeletons when isLoading', () => {
    const { container } = render(<RecentOrdersSection items={[]} isLoading />, { wrapper });
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders location when present', () => {
    render(<RecentOrdersSection items={mockItems} />, { wrapper });
    expect(screen.getByText('New York')).toBeInTheDocument();
  });

  it('renders vendor name when present', () => {
    render(<RecentOrdersSection items={mockItems} />, { wrapper });
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
  });

  it('renders date range when present', () => {
    render(<RecentOrdersSection items={mockItems} />, { wrapper });
    expect(screen.getByText('2026-01-01 - 2026-02-01')).toBeInTheDocument();
  });

  it('renders item count', () => {
    render(<RecentOrdersSection items={mockItems} />, { wrapper });
    expect(screen.getByText('5 items')).toBeInTheDocument();
  });

  it('renders singular "item" for count of 1', () => {
    const singleItem: RecentOrderItem[] = [{ ...mockItems[0], itemCount: 1 }];
    render(<RecentOrdersSection items={singleItem} />, { wrapper });
    expect(screen.getByText('1 item')).toBeInTheDocument();
  });

  it('renders total cost as formatted currency', () => {
    render(<RecentOrdersSection items={mockItems} />, { wrapper });
    // formatCurrency uses Intl.NumberFormat
    expect(screen.getByText('$10,000.00')).toBeInTheDocument();
  });

  it('renders remaining percent when present', () => {
    render(<RecentOrdersSection items={mockItems} />, { wrapper });
    expect(screen.getByText('Remaining quantity 75%')).toBeInTheDocument();
  });

  it('formats PO order id correctly', () => {
    const poItem: RecentOrderItem[] = [{ ...mockItems[0], id: 'abc12345', type: 'po' }];
    render(<RecentOrdersSection items={poItem} />, { wrapper });
    expect(screen.getByText('PO-abc12345')).toBeInTheDocument();
  });

  it('formats bulk-order id correctly', () => {
    const bulkItem: RecentOrderItem[] = [{ ...mockItems[0], id: 'bulk9999', type: 'bulk-order' }];
    render(<RecentOrdersSection items={bulkItem} />, { wrapper });
    expect(screen.getByText('BULK-bulk9999')).toBeInTheDocument();
  });

  it('navigates on card click', () => {
    render(<RecentOrdersSection items={mockItems} />, { wrapper });
    const cards = screen.getAllByRole('button');
    // The first role="button" is the card itself
    fireEvent.click(cards[0]);
    expect(cards[0]).toBeInTheDocument();
  });

  it('navigates on Enter key press', () => {
    render(<RecentOrdersSection items={mockItems} />, { wrapper });
    const cards = screen.getAllByRole('button');
    fireEvent.keyDown(cards[0], { key: 'Enter' });
    expect(cards[0]).toBeInTheDocument();
  });

  it('navigates on Space key press', () => {
    render(<RecentOrdersSection items={mockItems} />, { wrapper });
    const cards = screen.getAllByRole('button');
    fireEvent.keyDown(cards[0], { key: ' ' });
    expect(cards[0]).toBeInTheDocument();
  });

  it('does not render optional fields when absent', () => {
    const minimalItem: RecentOrderItem[] = [
      {
        id: '2',
        type: 'rfq',
        status: 'active',
        projectName: 'Minimal Project',
        vendorName: null as unknown as string,
        location: null as unknown as string,
        dateRange: null as unknown as string,
        itemCount: 0,
        totalCost: null as unknown as number,
        remainingPercent: null as unknown as number,
        hasMessages: false,
      },
    ];
    render(<RecentOrdersSection items={minimalItem} />, { wrapper });
    expect(screen.getByText('Minimal Project')).toBeInTheDocument();
  });

  it('formats unknown order type using uppercase', () => {
    const unknownType: RecentOrderItem[] = [
      { ...mockItems[0], id: 'xyz99999', type: 'invoice' as never },
    ];
    render(<RecentOrdersSection items={unknownType} />, { wrapper });
    expect(screen.getByText('INVOICE-xyz99999')).toBeInTheDocument();
  });

  it('does not render location when absent', () => {
    const noLocation: RecentOrderItem[] = [
      { ...mockItems[0], location: null as unknown as string },
    ];
    render(<RecentOrdersSection items={noLocation} />, { wrapper });
    expect(screen.queryByTestId('location-icon')).not.toBeInTheDocument();
  });

  it('does not render vendorName when absent', () => {
    const noVendor: RecentOrderItem[] = [
      { ...mockItems[0], vendorName: null as unknown as string },
    ];
    render(<RecentOrdersSection items={noVendor} />, { wrapper });
    expect(screen.queryByText('Acme Corp')).not.toBeInTheDocument();
  });

  it('does not render dateRange when absent', () => {
    const noDate: RecentOrderItem[] = [{ ...mockItems[0], dateRange: null as unknown as string }];
    render(<RecentOrdersSection items={noDate} />, { wrapper });
    expect(screen.queryByText('2026-01-01 - 2026-02-01')).not.toBeInTheDocument();
  });

  it('does not render itemCount when zero', () => {
    const noItems: RecentOrderItem[] = [{ ...mockItems[0], itemCount: 0 }];
    render(<RecentOrdersSection items={noItems} />, { wrapper });
    expect(screen.queryByText(/item/)).not.toBeInTheDocument();
  });

  it('does not render totalCost when null', () => {
    const noCost: RecentOrderItem[] = [{ ...mockItems[0], totalCost: null as unknown as number }];
    render(<RecentOrdersSection items={noCost} />, { wrapper });
    expect(screen.queryByText('$10,000.00')).not.toBeInTheDocument();
  });

  it('does not render remainingPercent when null', () => {
    const noRemaining: RecentOrderItem[] = [
      { ...mockItems[0], remainingPercent: null as unknown as number },
    ];
    render(<RecentOrdersSection items={noRemaining} />, { wrapper });
    expect(screen.queryByText(/Remaining quantity/)).not.toBeInTheDocument();
  });
});
