import type { PendingPoItem } from '@forethread/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockApprovePo = vi.hoisted(() => vi.fn());
const mockDeclinePo = vi.hoisted(() => vi.fn());

vi.mock('@forethread/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@forethread/api-client')>();
  return {
    ...actual,
    approvePurchaseOrder: mockApprovePo,
    declinePurchaseOrder: mockDeclinePo,
  };
});

vi.mock('@forethread/ui-components/assets/icons/file-text.svg?react', () => ({
  default: () => <span data-testid="file-text-icon" />,
}));
vi.mock('@forethread/ui-components/assets/icons/briefcase.svg?react', () => ({
  default: () => <span data-testid="briefcase-icon" />,
}));
vi.mock('@forethread/ui-components/assets/icons/date.svg?react', () => ({
  default: () => <span data-testid="date-icon" />,
}));
vi.mock('@forethread/ui-components/assets/icons/coins.svg?react', () => ({
  default: () => <span data-testid="coins-icon" />,
}));
vi.mock('@forethread/ui-components/assets/icons/package.svg?react', () => ({
  default: () => <span data-testid="package-icon" />,
}));
vi.mock('@forethread/ui-components/assets/icons/location.svg?react', () => ({
  default: () => <span data-testid="location-icon" />,
}));
vi.mock('@forethread/ui-components/assets/icons/checkcircle-icon.svg?react', () => ({
  default: () => <span data-testid="check-icon" />,
}));
vi.mock('@forethread/ui-components/assets/icons/cross-in-circle.svg?react', () => ({
  default: () => <span data-testid="cross-icon" />,
}));

import { PendingPurchaseOrders } from './PendingPurchaseOrders';

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

const mockItems: PendingPoItem[] = [
  {
    id: '1',
    vendorName: 'Acme Corp',
    vendorCountry: 'US',
    poNumber: 'PO-001',
    projectName: 'Project Alpha',
    date: '2026-01-15',
    itemCount: 3,
    deliveryType: 'DELIVERY',
    totalCost: 15000,
    status: 'pending',
  },
  {
    id: '2',
    vendorName: 'Beta Inc',
    vendorCountry: null,
    poNumber: 'PO-002',
    projectName: 'Project Beta',
    date: '2026-01-20',
    itemCount: 5,
    deliveryType: 'Pick up',
    totalCost: 8000,
    status: 'acknowledged',
  },
];

describe('PendingPurchaseOrders', () => {
  it('renders section title', () => {
    render(<PendingPurchaseOrders items={[]} />, { wrapper });
    expect(screen.getByText('purchaseOrders.title')).toBeInTheDocument();
  });

  it('shows empty state when no items', () => {
    render(<PendingPurchaseOrders items={[]} />, { wrapper });
    expect(screen.getByText('purchaseOrders.noPOs')).toBeInTheDocument();
  });

  it('renders all items on All tab by default', () => {
    render(<PendingPurchaseOrders items={mockItems} />, { wrapper });
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('Beta Inc')).toBeInTheDocument();
  });

  it('filters by pending tab', () => {
    render(<PendingPurchaseOrders items={mockItems} />, { wrapper });
    fireEvent.click(screen.getByText('purchaseOrders.pending'));
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.queryByText('Beta Inc')).not.toBeInTheDocument();
  });

  it('filters by acknowledged tab', () => {
    render(<PendingPurchaseOrders items={mockItems} />, { wrapper });
    fireEvent.click(screen.getByText('purchaseOrders.acknowledged'));
    expect(screen.getByText('Beta Inc')).toBeInTheDocument();
    expect(screen.queryByText('Acme Corp')).not.toBeInTheDocument();
  });

  it('renders Decline and Approve buttons', () => {
    render(<PendingPurchaseOrders items={[mockItems[0]]} />, { wrapper });
    expect(screen.getByText('purchaseOrders.decline')).toBeInTheDocument();
    expect(screen.getByText('purchaseOrders.approve')).toBeInTheDocument();
  });

  it('shows loading skeletons when isLoading', () => {
    const { container } = render(<PendingPurchaseOrders items={[]} isLoading />, { wrapper });
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('clicking approve button triggers approve mutation', async () => {
    mockApprovePo.mockResolvedValue(undefined);
    render(<PendingPurchaseOrders items={[mockItems[0]]} />, { wrapper });
    fireEvent.click(screen.getByText('purchaseOrders.approve'));
    await vi.waitFor(() => {
      expect(mockApprovePo).toHaveBeenCalledWith('1');
    });
  });

  it('clicking decline button triggers decline mutation', async () => {
    mockDeclinePo.mockResolvedValue(undefined);
    render(<PendingPurchaseOrders items={[mockItems[0]]} />, { wrapper });
    fireEvent.click(screen.getByText('purchaseOrders.decline'));
    await vi.waitFor(() => {
      expect(mockDeclinePo).toHaveBeenCalledWith('1');
    });
  });

  it('shows empty state when switching to pending with no pending items', () => {
    const allAcknowledged: PendingPoItem[] = [{ ...mockItems[1] }];
    render(<PendingPurchaseOrders items={allAcknowledged} />, { wrapper });
    fireEvent.click(screen.getByText('purchaseOrders.pending'));
    expect(screen.getByText('purchaseOrders.noPOs')).toBeInTheDocument();
  });

  it('clicking all tab shows all items', () => {
    render(<PendingPurchaseOrders items={mockItems} />, { wrapper });
    fireEvent.click(screen.getByText('purchaseOrders.pending'));
    fireEvent.click(screen.getByText('purchaseOrders.all'));
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('Beta Inc')).toBeInTheDocument();
  });
});
