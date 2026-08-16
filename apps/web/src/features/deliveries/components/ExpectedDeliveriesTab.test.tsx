import type { ExpectedDeliveryListItem } from '@forethread/shared-types/client';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockNavigate = vi.hoisted(() => vi.fn());
const mockUseExpectedDeliveries = vi.hoisted(() => vi.fn());
const mockHas = vi.hoisted(() => vi.fn((_perm: string) => true));

vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
  }),
}));
vi.mock('@forethread/ui-components', () => ({
  Badge: ({ children, ...props }: { children: ReactNode }) => <span {...props}>{children}</span>,
  Button: ({
    children,
    onClick,
    disabled,
    leftIcon: _l,
    isLoading: _il,
    variant: _v,
    size: _s,
    ...props
  }: Record<string, unknown>) => (
    <button onClick={onClick as () => void} disabled={disabled as boolean} {...props}>
      {children as ReactNode}
    </button>
  ),
  FilterDropdownButton: ({ label }: { label: string }) => <div>{label}</div>,
  SearchInput: (props: Record<string, unknown>) => <input {...props} />,
  Spinner: () => <div data-testid="spinner" />,
  TablePagination: ({ totalItems }: { totalItems: number }) => (
    <div data-testid="pagination">total:{totalItems}</div>
  ),
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
  formatDate: (d: string) => `fmt:${d}`,
  getStatusColor: () => '',
  EXPECTED_DELIVERY_STATUS_COLORS: {},
  useDebounce: (v: unknown) => v,
}));
vi.mock('@forethread/ui-components/assets/icons/eye-opened.svg?react', () => ({
  default: () => <svg />,
}));
vi.mock('@forethread/ui-components/assets/icons/plus-in-circle.svg?react', () => ({
  default: () => <svg />,
}));
vi.mock('@/app/route-config', () => ({
  ROUTES: {
    deliveries: '/deliveries',
    deliveryNew: '/deliveries/new',
    purchaseOrderDetail: '/purchase-orders/:id',
  },
}));
vi.mock('@/shared/role/usePermissions', () => ({ usePermissions: () => ({ has: mockHas }) }));
vi.mock('../services/deliveries.service', () => ({
  useExpectedDeliveries: (params: unknown) => mockUseExpectedDeliveries(params),
  useDeliveryProjects: () => ({ data: [] }),
  useDeliveryVendors: () => ({ data: [] }),
}));

import { ExpectedDeliveriesTab } from './ExpectedDeliveriesTab';

function item(overrides: Partial<ExpectedDeliveryListItem> = {}): ExpectedDeliveryListItem {
  return {
    purchaseOrderId: 'po-1',
    poNumber: 'PO-234567',
    poStatus: 'ACCEPTED',
    progress: 'AWAITING_DELIVERY',
    expectedDeliveryDate: '2026-08-20T00:00:00.000Z',
    isOverdue: false,
    itemCount: 3,
    projectId: 'p1',
    projectName: 'Downtown Office',
    vendorId: 'v1',
    vendorName: 'BuildSupply Co',
    deliveryLocationId: 'l1',
    deliveryLocationName: 'Main Warehouse',
    hasPendingReport: false,
    createdAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

function loaded(items: ExpectedDeliveryListItem[]) {
  mockUseExpectedDeliveries.mockReturnValue({
    isLoading: false,
    isError: false,
    data: { items, meta: { total: items.length } },
  });
}

describe('ExpectedDeliveriesTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHas.mockReturnValue(true);
  });

  it('shows the spinner while loading', () => {
    mockUseExpectedDeliveries.mockReturnValue({ isLoading: true });
    render(<ExpectedDeliveriesTab />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('renders the empty state when no POs await delivery', () => {
    loaded([]);
    render(<ExpectedDeliveriesTab />);
    expect(screen.getByText('expected.empty')).toBeInTheDocument();
  });

  it('shows the error state on failure', () => {
    mockUseExpectedDeliveries.mockReturnValue({ isLoading: false, isError: true, data: undefined });
    render(<ExpectedDeliveriesTab />);
    expect(screen.getByText('expected.loadFailed')).toBeInTheDocument();
  });

  it('renders a card with PO number, status badge and the delivery fields', () => {
    loaded([item()]);
    render(<ExpectedDeliveriesTab />);
    const card = screen.getByTestId('expected-card-po-1');
    expect(within(card).getByText('PO-234567')).toBeInTheDocument();
    expect(within(card).getByText('expected.status.AWAITING_DELIVERY')).toBeInTheDocument();
    expect(within(card).getByText('Downtown Office')).toBeInTheDocument();
    expect(within(card).getByText('BuildSupply Co')).toBeInTheDocument();
    expect(within(card).getByText('Main Warehouse')).toBeInTheDocument();
    expect(within(card).getByText('3')).toBeInTheDocument();
    expect(within(card).getByText('fmt:2026-08-20T00:00:00.000Z')).toBeInTheDocument();
    expect(screen.queryByTestId('expected-overdue-po-1')).not.toBeInTheDocument();
  });

  it('flags an overdue PO with the red badge and a red expected date', () => {
    loaded([item({ isOverdue: true })]);
    render(<ExpectedDeliveriesTab />);
    expect(screen.getByTestId('expected-overdue-po-1')).toHaveTextContent(
      'expected.status.OVERDUE',
    );
    expect(screen.getByTestId('expected-date-po-1').className).toContain('text-destructive');
  });

  it('shows the pending-report hint when a report awaits review', () => {
    loaded([item({ hasPendingReport: true })]);
    render(<ExpectedDeliveriesTab />);
    expect(screen.getByText('expected.pendingReport')).toBeInTheDocument();
  });

  it('navigates to the pre-filled create form from Record delivery', () => {
    loaded([item()]);
    render(<ExpectedDeliveriesTab />);
    fireEvent.click(screen.getByTestId('expected-record-po-1'));
    expect(mockNavigate).toHaveBeenCalledWith('/deliveries/new?poId=po-1');
  });

  it('hides Record delivery without the delivery.create permission', () => {
    mockHas.mockImplementation((perm: string) => perm !== 'delivery.create');
    loaded([item()]);
    render(<ExpectedDeliveriesTab />);
    expect(screen.queryByTestId('expected-record-po-1')).not.toBeInTheDocument();
  });

  it('navigates to the PO detail from the eye button', () => {
    loaded([item()]);
    render(<ExpectedDeliveriesTab />);
    fireEvent.click(screen.getByTestId('expected-view-po-po-1'));
    expect(mockNavigate).toHaveBeenCalledWith('/purchase-orders/po-1');
  });

  it('toggles the overdue quick filter into the query params', () => {
    loaded([]);
    render(<ExpectedDeliveriesTab />);
    expect(mockUseExpectedDeliveries).toHaveBeenLastCalledWith(
      expect.objectContaining({ overdue: undefined }),
    );
    fireEvent.click(screen.getByTestId('expected-overdue-filter'));
    expect(mockUseExpectedDeliveries).toHaveBeenLastCalledWith(
      expect.objectContaining({ overdue: true }),
    );
  });
});
