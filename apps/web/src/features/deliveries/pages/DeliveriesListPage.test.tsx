import type { DeliveryReportListItem } from '@forethread/shared-types/client';
import { DeliveryReportSource, DeliveryReportStatus } from '@forethread/shared-types/client';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockNavigate = vi.hoisted(() => vi.fn());
const mockUseDeliveryReports = vi.hoisted(() => vi.fn());
const mockApprove = vi.hoisted(() => vi.fn());
const mockReject = vi.hoisted(() => vi.fn());
const mockHas = vi.hoisted(() => vi.fn(() => true));

vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
  }),
}));
vi.mock('@forethread/rfq-shared', () => ({
  usePageTitleStore: (sel: (s: { setTitle: () => void }) => unknown) => sel({ setTitle: () => {} }),
}));
vi.mock('@forethread/ui-components', () => ({
  useIsPhone: () => false,
  MobileListToolbar: () => null,
  FloatingActionButton: () => null,
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
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
  Tabs: ({
    items,
    onValueChange,
  }: {
    items: { value: string; label: ReactNode }[];
    onValueChange: (v: string) => void;
  }) => (
    <div data-testid="tabs">
      {items.map((item) => (
        <button key={item.value} onClick={() => onValueChange(item.value)}>
          {item.label}
        </button>
      ))}
    </div>
  ),
  Spinner: () => <div data-testid="spinner" />,
  TablePagination: ({ totalItems }: { totalItems: number }) => (
    <div data-testid="pagination">total:{totalItems}</div>
  ),
  getStatusColor: () => '',
  DELIVERY_STATUS_COLORS: {},
  useDebounce: (v: unknown) => v,
  notificationService: { success: vi.fn(), error: vi.fn() },
}));
vi.mock('@forethread/ui-components/assets/icons/eye-opened.svg?react', () => ({
  default: () => <svg />,
}));
vi.mock('@forethread/ui-components/assets/icons/checkcircle-icon.svg?react', () => ({
  default: () => <svg />,
}));
vi.mock('@forethread/ui-components/assets/icons/cross-in-circle.svg?react', () => ({
  default: () => <svg />,
}));
vi.mock('@forethread/ui-components/assets/icons/plus-in-circle.svg?react', () => ({
  default: () => <svg />,
}));
vi.mock('@forethread/ui-components/assets/icons/upload.svg?react', () => ({
  default: () => <svg />,
}));
vi.mock('@/app/route-config', () => ({
  ROUTES: {
    deliveries: '/deliveries',
    deliveryNew: '/deliveries/new',
    deliveryDetail: '/deliveries/:id',
  },
}));
vi.mock('@/shared/role/usePermissions', () => ({ usePermissions: () => ({ has: mockHas }) }));
vi.mock('../components/ExpectedDeliveriesTab', () => ({
  ExpectedDeliveriesTab: () => <div data-testid="expected-tab" />,
}));
vi.mock('../components/SelectPoModal', () => ({
  SelectPoModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="select-po-modal" /> : null,
}));
vi.mock('../components/RejectDeliveryModal', () => ({
  RejectDeliveryModal: ({ onConfirm }: { onConfirm: (r: string) => void }) => (
    <div data-testid="reject-modal">
      <button onClick={() => onConfirm('bad')}>do-reject</button>
    </div>
  ),
}));
vi.mock('../services/deliveries.service', () => ({
  useDeliveryReports: (params: unknown) => mockUseDeliveryReports(params),
  useApproveDeliveryReport: () => ({ mutate: mockApprove, isPending: false }),
  useRejectDeliveryReport: () => ({ mutate: mockReject, isPending: false }),
  useDeliveryProjects: () => ({ data: [] }),
  useDeliveryVendors: () => ({ data: [] }),
}));

import DeliveriesListPage from './DeliveriesListPage';

function report(overrides: Partial<DeliveryReportListItem> = {}): DeliveryReportListItem {
  return {
    id: 'd-1',
    reportNumber: 'DR-0001',
    status: DeliveryReportStatus.SUBMITTED,
    source: DeliveryReportSource.INTERNAL,
    purchaseOrderId: 'po-1',
    poNumber: 'PO-234567',
    deliveryDate: '2024-12-12T12:00:00.000Z',
    projectId: 'p1',
    projectName: 'Downtown Office',
    vendorId: 'v1',
    vendorName: 'BuildSupply Co',
    deliveryLocationId: 'l1',
    deliveryLocationName: 'Main Warehouse',
    linkedRfqNumber: 'RFQ-1234567',
    invoiceNumber: 'INV-12345678',
    submitterName: 'Marcus Webb',
    createdAt: '2024-12-12T12:00:00.000Z',
    ...overrides,
  };
}

/** Render the page and switch to the Reports tab (the page defaults to Expected). */
function renderReports() {
  render(<DeliveriesListPage />);
  fireEvent.click(screen.getByText('list.tabs.reports'));
}

describe('DeliveriesListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHas.mockReturnValue(true);
  });

  it('defaults to the Expected tab (FOR-356)', () => {
    mockUseDeliveryReports.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { items: [] },
    });
    render(<DeliveriesListPage />);
    expect(screen.getByTestId('expected-tab')).toBeInTheDocument();
    expect(screen.queryByText('list.empty')).not.toBeInTheDocument();
  });

  it('switches between the Expected and Reports tabs', () => {
    mockUseDeliveryReports.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { items: [] },
    });
    render(<DeliveriesListPage />);
    fireEvent.click(screen.getByText('list.tabs.reports'));
    expect(screen.queryByTestId('expected-tab')).not.toBeInTheDocument();
    expect(screen.getByText('list.empty')).toBeInTheDocument();
    fireEvent.click(screen.getByText('list.tabs.expected'));
    expect(screen.getByTestId('expected-tab')).toBeInTheDocument();
  });

  it('shows the spinner while loading', () => {
    mockUseDeliveryReports.mockReturnValue({ isLoading: true });
    renderReports();
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('renders the empty state when there are no reports', () => {
    mockUseDeliveryReports.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { items: [] },
    });
    renderReports();
    expect(screen.getByText('list.empty')).toBeInTheDocument();
  });

  it('shows the error state on failure', () => {
    mockUseDeliveryReports.mockReturnValue({ isLoading: false, isError: true, data: undefined });
    renderReports();
    expect(screen.getByText('list.loadFailed')).toBeInTheDocument();
  });

  it('renders a card with PO number and the delivery fields', () => {
    mockUseDeliveryReports.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { items: [report()], meta: { total: 1 } },
    });
    renderReports();
    const card = screen.getByTestId('delivery-card-d-1');
    expect(within(card).getByText('PO-234567')).toBeInTheDocument();
    expect(within(card).getByText('Downtown Office')).toBeInTheDocument();
    expect(within(card).getByText('BuildSupply Co')).toBeInTheDocument();
    expect(within(card).getByText('RFQ-1234567')).toBeInTheDocument();
  });

  it('navigates to the detail page when the eye button is clicked', () => {
    mockUseDeliveryReports.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { items: [report({ id: 'd-42' })], meta: { total: 1 } },
    });
    renderReports();
    fireEvent.click(screen.getByTestId('delivery-view-d-42'));
    expect(mockNavigate).toHaveBeenCalledWith('/deliveries/d-42');
  });

  it('approves a SUBMITTED report from the inline action', () => {
    mockUseDeliveryReports.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { items: [report({ id: 'd-7' })], meta: { total: 1 } },
    });
    renderReports();
    fireEvent.click(screen.getByTestId('delivery-approve-d-7'));
    expect(mockApprove).toHaveBeenCalledWith('d-7', expect.anything());
  });

  it('opens the reject modal and rejects with a reason', () => {
    mockUseDeliveryReports.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { items: [report({ id: 'd-9' })], meta: { total: 1 } },
    });
    renderReports();
    fireEvent.click(screen.getByTestId('delivery-reject-d-9'));
    fireEvent.click(screen.getByText('do-reject'));
    expect(mockReject).toHaveBeenCalledWith({ id: 'd-9', reason: 'bad' }, expect.anything());
  });

  it('does not show inline approve/reject for non-SUBMITTED reports', () => {
    mockUseDeliveryReports.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        items: [report({ id: 'd-3', status: DeliveryReportStatus.APPROVED })],
        meta: { total: 1 },
      },
    });
    renderReports();
    expect(screen.queryByTestId('delivery-approve-d-3')).not.toBeInTheDocument();
    expect(screen.queryByTestId('delivery-reject-d-3')).not.toBeInTheDocument();
  });

  it('opens the PO picker from the Create new button', () => {
    mockUseDeliveryReports.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { items: [] },
    });
    renderReports();
    fireEvent.click(screen.getByTestId('delivery-create-new'));
    expect(screen.getByTestId('select-po-modal')).toBeInTheDocument();
  });
});
