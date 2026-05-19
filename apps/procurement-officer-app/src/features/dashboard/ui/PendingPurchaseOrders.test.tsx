vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@forethread/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@forethread/api-client')>();
  return { ...actual, approvePurchaseOrder: vi.fn(), declinePurchaseOrder: vi.fn() };
});

vi.mock('@forethread/ui-components', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
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
  DashboardItemCard: ({
    name,
    fields,
    actions,
    onCardClick,
  }: {
    name: string;
    fields: Array<{ icon: React.ReactNode; value: string }>;
    actions: React.ReactNode;
    onCardClick?: () => void;
  }) => (
    <div data-testid="po-card">
      <span>{name}</span>
      {fields?.map((f, i) => (
        <span key={i}>{f.value}</span>
      ))}
      {actions}
      {onCardClick && (
        <button data-testid="card-click" onClick={onCardClick}>
          card
        </button>
      )}
    </div>
  ),
  DashboardSectionSkeleton: ({ title }: { title: string }) => (
    <div data-testid="skeleton">{title}</div>
  ),
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
}));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';

import { PendingPurchaseOrders } from './PendingPurchaseOrders';

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const mockItem = {
  id: 'po-1',
  vendorName: 'Vendor X',
  poNumber: 'PO-001',
  projectName: 'Project A',
  date: '2025-01-01',
  totalCost: 5000,
  itemCount: 3,
  deliveryType: 'Express',
  status: 'pending',
  hasUnreadMessages: false,
  hasAttachments: true,
};

describe('PendingPurchaseOrders', () => {
  it('shows skeleton when loading', () => {
    render(<PendingPurchaseOrders items={[]} isLoading />, { wrapper });
    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  });

  it('shows empty message', () => {
    render(<PendingPurchaseOrders items={[]} />, { wrapper });
    expect(screen.getByText('purchaseOrders.noPOs')).toBeInTheDocument();
  });

  it('renders items', () => {
    render(<PendingPurchaseOrders items={[mockItem as never]} />, { wrapper });
    expect(screen.getByText('Vendor X')).toBeInTheDocument();
    expect(screen.getByText('PO-001')).toBeInTheDocument();
  });

  it('filters by tab', () => {
    render(<PendingPurchaseOrders items={[mockItem as never]} />, { wrapper });
    fireEvent.click(screen.getByText('purchaseOrders.acknowledged'));
    expect(screen.getByText('purchaseOrders.noPOs')).toBeInTheDocument();

    fireEvent.click(screen.getByText('purchaseOrders.pending'));
    expect(screen.getByText('Vendor X')).toBeInTheDocument();
  });

  it('calls approve mutation when approve is clicked', () => {
    render(<PendingPurchaseOrders items={[mockItem as never]} />, { wrapper });
    fireEvent.click(screen.getByText('purchaseOrders.approve'));
  });

  it('calls decline mutation when decline is clicked', () => {
    render(<PendingPurchaseOrders items={[mockItem as never]} />, { wrapper });
    fireEvent.click(screen.getByText('purchaseOrders.decline'));
  });

  it('navigates on card click', () => {
    render(<PendingPurchaseOrders items={[mockItem as never]} />, { wrapper });
    fireEvent.click(screen.getByTestId('card-click'));
  });
});
