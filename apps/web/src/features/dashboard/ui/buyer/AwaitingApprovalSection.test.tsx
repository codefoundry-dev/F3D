import type { PoDetail } from '@forethread/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

const mockApprove = vi.hoisted(() => vi.fn((_id: string) => Promise.resolve()));
const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@forethread/api-client', () => ({
  approvePurchaseOrder: (id: string) => mockApprove(id),
}));

vi.mock('@forethread/ui-components', () => ({
  Badge: ({ children }: { children: ReactNode }) => <span data-testid="badge">{children}</span>,
  DashboardItemCard: ({
    name,
    actions,
    fields,
    onCardClick,
  }: {
    name: string;
    actions?: ReactNode;
    fields: { value: string }[];
    onCardClick?: () => void;
  }) => (
    <div data-testid="item-card">
      <button data-testid="card-body" onClick={onCardClick}>
        {name}
      </button>
      {fields.map((f, i) => (
        <span key={i} data-testid="field">
          {f.value}
        </span>
      ))}
      {actions}
    </div>
  ),
  DashboardSectionSkeleton: ({ title }: { title: string }) => (
    <div data-testid="skeleton">{title}</div>
  ),
  formatCurrency: (v: number | null) => `$${v ?? 0}`,
  formatDate: (v: string) => `date(${v})`,
  formatStatus: (v: string) => v,
}));

vi.mock('@forethread/ui-components/assets/icons/briefcase.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/checkcircle-icon.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/coins.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/cross-in-circle.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/date.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/file-text.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/location.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/package.svg?react', () => ({
  default: () => <span />,
}));

vi.mock('@/features/purchase-orders/buyer/components/DeclinePoReasonModal', () => ({
  DeclinePoReasonModal: ({ poId }: { poId: string }) => (
    <div data-testid="decline-modal">{poId}</div>
  ),
}));

vi.mock('@/app/route-config', () => ({
  ROUTES: { purchaseOrderDetail: '/purchase-orders/:id' },
}));

import { AwaitingApprovalSection } from './AwaitingApprovalSection';

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function makePo(overrides: Partial<PoDetail> = {}): PoDetail {
  return {
    id: 'po-1',
    poNumber: 'PO-001',
    projectName: 'Riverside Tower',
    status: 'PENDING_APPROVAL',
    pickUp: false,
    currency: 'USD',
    totalAmount: 12000,
    lineItemCount: 3,
    vendor: { id: 'v-1', name: 'Acme Supplies' },
    createdAt: '2026-02-01T00:00:00.000Z',
    ...overrides,
  } as PoDetail;
}

describe('AwaitingApprovalSection', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders a skeleton while loading', () => {
    render(<AwaitingApprovalSection items={[]} isLoading />, { wrapper });
    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  });

  it('renders the empty state when there are no items', () => {
    render(<AwaitingApprovalSection items={[]} />, { wrapper });
    expect(screen.getByText('No purchase orders awaiting your approval')).toBeInTheDocument();
  });

  it('renders a card per pending PO with vendor + PO number', () => {
    render(
      <AwaitingApprovalSection
        items={[
          makePo({ id: 'po-1' }),
          makePo({ id: 'po-2', poNumber: 'PO-002', vendor: { id: 'v-2', name: 'Globex Co' } }),
        ]}
      />,
      { wrapper },
    );
    expect(screen.getAllByTestId('item-card')).toHaveLength(2);
    expect(screen.getByText('Acme Supplies')).toBeInTheDocument();
    expect(screen.getByText('Globex Co')).toBeInTheDocument();
    expect(screen.getByText('PO-002')).toBeInTheDocument();
  });

  it('calls approvePurchaseOrder when Approve is clicked', async () => {
    render(<AwaitingApprovalSection items={[makePo()]} />, { wrapper });
    fireEvent.click(screen.getByText('purchaseOrders.approve'));
    await waitFor(() => expect(mockApprove).toHaveBeenCalledWith('po-1'));
  });

  it('opens the decline modal when Decline is clicked', () => {
    render(<AwaitingApprovalSection items={[makePo()]} />, { wrapper });
    expect(screen.queryByTestId('decline-modal')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('purchaseOrders.decline'));
    expect(screen.getByTestId('decline-modal')).toHaveTextContent('po-1');
  });

  it('navigates to the PO detail when the card body is clicked', () => {
    render(<AwaitingApprovalSection items={[makePo()]} />, { wrapper });
    fireEvent.click(screen.getByTestId('card-body'));
    expect(mockNavigate).toHaveBeenCalledWith('/purchase-orders/po-1');
  });
});
