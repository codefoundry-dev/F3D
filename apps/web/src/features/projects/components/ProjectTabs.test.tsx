import { render, screen, fireEvent } from '@testing-library/react';

const mockUseRfqs = vi.hoisted(() => vi.fn());
const mockUsePurchaseOrders = vi.hoisted(() => vi.fn());
const mockUseInvoices = vi.hoisted(() => vi.fn());
const mockUseBulkOrders = vi.hoisted(() => vi.fn());
const mockUseBulkOrder = vi.hoisted(() => vi.fn());
const mockUseVendors = vi.hoisted(() => vi.fn());

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/rfq-shared', () => ({ useRfqs: mockUseRfqs }));
vi.mock('@forethread/po-shared', () => ({ usePurchaseOrders: mockUsePurchaseOrders }));
vi.mock('@forethread/invoice-shared', () => ({ useInvoices: mockUseInvoices }));
vi.mock('@forethread/bulk-order-shared', () => ({
  useBulkOrders: mockUseBulkOrders,
  useBulkOrder: mockUseBulkOrder,
}));
vi.mock('@forethread/vendor-shared', () => ({ useVendors: mockUseVendors }));

vi.mock('@forethread/ui-components', () => ({
  Badge: ({ children }: any) => <span data-testid="badge">{children}</span>,
  Spinner: () => <div data-testid="spinner" />,
  EmptyState: (props: any) => (
    <div data-testid="empty-state">
      <span>{props.title}</span>
      <span>{props.description}</span>
    </div>
  ),
  getStatusColor: () => 'status-class',
  RFQ_STATUS_COLORS: {},
  PO_STATUS_COLORS: {},
  BULK_ORDER_STATUS_COLORS: {},
  INVOICE_STATUS_COLORS: {},
}));

vi.mock('@forethread/ui-components/assets/icons/chevron-down.svg?react', () => ({
  default: () => <span data-testid="chevron-icon" />,
}));

vi.mock('react-router-dom', () => ({
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

import ProjectFinancialsTab from './ProjectFinancialsTab';
import ProjectProcurementTab from './ProjectProcurementTab';
import ProjectVendorsTab from './ProjectVendorsTab';

const loaded = (items: any[], total = items.length) => ({
  data: { items, meta: { page: 1, limit: 100, total, totalPages: 1 } },
  isLoading: false,
  isError: false,
});
const loading = { data: undefined, isLoading: true, isError: false };

beforeEach(() => {
  vi.clearAllMocks();
  mockUseRfqs.mockReturnValue(loaded([]));
  mockUsePurchaseOrders.mockReturnValue(loaded([]));
  mockUseInvoices.mockReturnValue(loaded([]));
  mockUseBulkOrders.mockReturnValue(loaded([]));
  mockUseVendors.mockReturnValue(loaded([]));
  mockUseBulkOrder.mockReturnValue({ data: undefined, isLoading: false, isError: false });
});

describe('ProjectProcurementTab', () => {
  it('passes the projectId filter to every list hook', () => {
    render(<ProjectProcurementTab projectId="proj-1" currency="AUD" />);
    expect(mockUseRfqs).toHaveBeenCalledWith({ projectId: 'proj-1', limit: 100 });
    expect(mockUsePurchaseOrders).toHaveBeenCalledWith({ projectId: 'proj-1', limit: 100 });
    expect(mockUseBulkOrders).toHaveBeenCalledWith({ projectId: 'proj-1', limit: 100 });
  });

  it('renders RFQ and PO rows linking to their detail pages', () => {
    mockUseRfqs.mockReturnValue(
      loaded([
        {
          id: 'rfq-1',
          rfqNumber: 'RFQ-001',
          status: 'OPEN',
          lineItems: 3,
          invitedVendors: 2,
          recQuotes: 1,
          createdDate: '2026-08-01T00:00:00Z',
          createdBy: 'Alice',
        },
      ]),
    );
    mockUsePurchaseOrders.mockReturnValue(
      loaded([
        {
          id: 'po-1',
          poNumber: 'PO-001',
          poType: 'STANDARD',
          vendorName: 'Acme Supplies',
          status: 'SENT',
          lineItemCount: 2,
          totalAmount: 500,
          currency: 'AUD',
          createdDate: '2026-08-02T00:00:00Z',
        },
      ]),
    );
    render(<ProjectProcurementTab projectId="proj-1" currency="AUD" />);
    expect(screen.getByText('RFQ-001').closest('a')).toHaveAttribute('href', '/rfqs/rfq-1');
    expect(screen.getByText('PO-001').closest('a')).toHaveAttribute(
      'href',
      '/purchase-orders/po-1',
    );
    expect(screen.getByText('Acme Supplies')).toBeInTheDocument();
  });

  it('renders empty states when the project has no documents', () => {
    render(<ProjectProcurementTab projectId="proj-1" currency="AUD" />);
    expect(screen.getByText('detail.procurementTab.noRfqs')).toBeInTheDocument();
    expect(screen.getByText('detail.procurementTab.noPos')).toBeInTheDocument();
    expect(screen.getByText('detail.procurementTab.noBulkOrders')).toBeInTheDocument();
  });

  it('expands a bulk order row to show its drawdown history', () => {
    mockUseBulkOrders.mockReturnValue(
      loaded([
        {
          id: 'bo-1',
          bulkOrderNumber: 'BULK-0001',
          vendorName: 'Acme Supplies',
          status: 'ACTIVE',
          lineItems: 2,
          totalAmount: 10000,
          consumptionPercent: 40,
          validUntil: '2026-12-31T00:00:00Z',
        },
      ]),
    );
    mockUseBulkOrder.mockReturnValue({
      data: {
        id: 'bo-1',
        drawdowns: [
          {
            id: 'dd-1',
            purchaseOrderId: 'po-9',
            poNumber: 'PO-009',
            material: 'Cement',
            quantity: 10,
            qtyBeforeDrawdown: 50,
            remainingQty: 40,
            date: '2026-08-10T00:00:00Z',
          },
        ],
      },
      isLoading: false,
      isError: false,
    });
    render(<ProjectProcurementTab projectId="proj-1" currency="AUD" />);
    fireEvent.click(screen.getByLabelText('detail.procurementTab.expandDrawdowns'));
    expect(screen.getByText('Cement')).toBeInTheDocument();
    expect(screen.getByText('PO-009').closest('a')).toHaveAttribute(
      'href',
      '/purchase-orders/po-9',
    );
  });
});

describe('ProjectVendorsTab', () => {
  it('derives vendors from POs, bulk orders and invoices, aggregating per vendor', () => {
    mockUsePurchaseOrders.mockReturnValue(
      loaded([
        { id: 'po-1', vendorName: 'Acme Supplies', totalAmount: 100, status: 'SENT' },
        { id: 'po-2', vendorName: 'Acme Supplies', totalAmount: 200, status: 'SENT' },
        { id: 'po-3', vendorName: 'Beta Traders', totalAmount: 50, status: 'SENT' },
      ]),
    );
    mockUseBulkOrders.mockReturnValue(
      loaded([
        {
          id: 'bo-1',
          bulkOrderNumber: 'BULK-0001',
          vendorName: 'Acme Supplies',
          status: 'ACTIVE',
          lineItems: 1,
          totalAmount: 2000,
          consumptionPercent: 10,
          validUntil: null,
        },
      ]),
    );
    mockUseInvoices.mockReturnValue(
      loaded([{ id: 'inv-1', vendorName: 'Acme Supplies', totalAmount: 120, status: 'PENDING' }]),
    );
    mockUseVendors.mockReturnValue(
      loaded([{ id: 'v-1', companyId: 'comp-1', companyName: 'Acme Supplies', status: 'ACTIVE' }]),
    );
    render(<ProjectVendorsTab projectId="proj-1" currency="AUD" />);

    // The matched vendor links to its detail page; the unmatched one is plain
    // text. The name also appears in the bulk-agreements table below, so pick
    // the linked occurrence.
    const acmeLink = screen.getAllByText('Acme Supplies').find((el) => el.closest('a') !== null);
    expect(acmeLink!.closest('a')).toHaveAttribute('href', '/vendors/comp-1');
    expect(screen.getByText('Beta Traders').closest('a')).toBeNull();

    const acmeRow = acmeLink!.closest('tr')!;
    expect(acmeRow).toHaveTextContent('2'); // PO count
    expect(acmeRow).toHaveTextContent('300'); // summed PO total
  });

  it('renders the empty state when no documents name a vendor', () => {
    render(<ProjectVendorsTab projectId="proj-1" currency="AUD" />);
    expect(screen.getByText('detail.vendorsTab.noVendors')).toBeInTheDocument();
  });
});

describe('ProjectFinancialsTab', () => {
  it('computes committed spend excluding draft and cancelled POs', () => {
    mockUsePurchaseOrders.mockReturnValue(
      loaded([
        { id: 'po-1', status: 'SENT', totalAmount: 1000 },
        { id: 'po-2', status: 'DRAFT', totalAmount: 500 },
        { id: 'po-3', status: 'CANCELLED', totalAmount: 300 },
      ]),
    );
    render(<ProjectFinancialsTab projectId="proj-1" plannedBudget={5000} currency="AUD" />);
    const committedCard = screen
      .getByText('detail.financialsTab.committed')
      .closest('div') as HTMLElement;
    expect(committedCard).toHaveTextContent('1,000');
    const remainingCard = screen
      .getByText('detail.financialsTab.remaining')
      .closest('div') as HTMLElement;
    expect(remainingCard).toHaveTextContent('4,000');
  });

  it('computes invoiced total excluding rejected invoices and lists invoices with links', () => {
    mockUseInvoices.mockReturnValue(
      loaded([
        {
          id: 'inv-1',
          invoiceNumber: 'INV-01',
          vendorName: 'Acme Supplies',
          relatedPo: 'PO-001',
          status: 'APPROVED',
          totalAmount: 750,
          dueDate: '2026-09-01T00:00:00Z',
        },
        {
          id: 'inv-2',
          invoiceNumber: 'INV-02',
          vendorName: 'Acme Supplies',
          relatedPo: null,
          status: 'REJECTED',
          totalAmount: 999,
          dueDate: null,
        },
      ]),
    );
    render(<ProjectFinancialsTab projectId="proj-1" plannedBudget={null} currency="AUD" />);
    const invoicedCard = screen
      .getByText('detail.financialsTab.invoiced')
      .closest('div') as HTMLElement;
    expect(invoicedCard).toHaveTextContent('750');
    expect(invoicedCard).not.toHaveTextContent('999');
    expect(screen.getByText('INV-01').closest('a')).toHaveAttribute('href', '/invoices/inv-1');
  });

  it('shows a loading placeholder while the summary queries are in flight', () => {
    mockUsePurchaseOrders.mockReturnValue(loading);
    mockUseInvoices.mockReturnValue(loading);
    render(<ProjectFinancialsTab projectId="proj-1" plannedBudget={5000} currency="AUD" />);
    const committedCard = screen
      .getByText('detail.financialsTab.committed')
      .closest('div') as HTMLElement;
    expect(committedCard).toHaveTextContent('…');
  });
});
