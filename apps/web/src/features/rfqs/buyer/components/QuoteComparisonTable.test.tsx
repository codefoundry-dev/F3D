import { QuoteComparisonTable } from '@forethread/rfq-shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/* ── Mocks ──────────────────────────────────────────────────────────────── */

const mockGetComparison = vi.hoisted(() => vi.fn());
const mockUpdateLineStatuses = vi.hoisted(() => vi.fn());
const mockApproveQuote = vi.hoisted(() => vi.fn());
const mockDeclineQuote = vi.hoisted(() => vi.fn());
const mockCreatePo = vi.hoisted(() => vi.fn());
const mockCreateBulk = vi.hoisted(() => vi.fn());
const mockAwardSplit = vi.hoisted(() => vi.fn());

vi.mock('@forethread/api-client', () => ({
  getRfqQuoteComparison: mockGetComparison,
  updateQuoteLineItemStatuses: mockUpdateLineStatuses,
  approveQuote: mockApproveQuote,
  declineQuote: mockDeclineQuote,
  createPurchaseOrder: mockCreatePo,
  createBulkOrder: mockCreateBulk,
  awardSplit: mockAwardSplit,
  awardQuote: vi.fn(),
  getQuoteDetail: vi.fn(),
  getRfqs: vi.fn(),
  getRfq: vi.fn(),
  getRfqEmailLog: vi.fn(),
  getRfqQuoteAudit: vi.fn(),
}));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts && 'count' in opts ? `${key}:${String(opts.count)}` : key,
  }),
}));


/* ── Fixtures ───────────────────────────────────────────────────────────── */

function cell(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    vendorId: 'v-1',
    quoteResponseId: 'q-1',
    quoteLineItemId: 'ql-1',
    unitPrice: 22.5,
    quotedQuantity: 500,
    extendedCost: 11250,
    lineTotal: 22500,
    discount: 5,
    discountType: 'PERCENT',
    availability: 'AVAILABLE',
    deliveryDate: '2024-12-15T00:00:00.000Z',
    status: 'PENDING',
    notes: null,
    substituteItemId: null,
    substituteItemName: null,
    hasQuote: true,
    isLowest: false,
    ...overrides,
  };
}

const comparison = {
  rfqId: 'rfq-1',
  currency: 'AUD',
  vendors: [
    {
      quoteResponseId: 'q-1',
      vendorId: 'v-1',
      vendorName: 'Vendor One',
      status: 'SUBMITTED',
      submittedAt: '2026-06-01T00:00:00.000Z',
      paymentTerms: 'Net 30',
      leadTimeDate: '2026-01-25T00:00:00.000Z',
      total: 33750,
      totalWithTaxes: 57585,
      discountPercent: 8,
      discountAmount: 10000,
      shipmentAndHandling: 850,
      attachmentCount: 1,
      hasNotes: true,
      itemsCovered: 2,
      totalItems: 3,
    },
    {
      quoteResponseId: 'q-2',
      vendorId: 'v-2',
      vendorName: 'Vendor Two',
      status: 'DECLINED',
      submittedAt: '2026-06-02T00:00:00.000Z',
      paymentTerms: null,
      leadTimeDate: '2026-02-10T00:00:00.000Z',
      total: 40000,
      totalWithTaxes: 61000,
      discountPercent: null,
      discountAmount: null,
      shipmentAndHandling: null,
      attachmentCount: 0,
      hasNotes: false,
      itemsCovered: 1,
      totalItems: 3,
    },
  ],
  rows: [
    {
      rfqLineItemId: 'li-1',
      materialName: 'Rubber Hoses',
      quantity: 500,
      unit: 'meters',
      projectId: 'p-1',
      projectName: 'Project One',
      lowestVendorId: 'v-1',
      cells: [
        cell({ isLowest: true, notes: 'note from vendor' }),
        cell({
          vendorId: 'v-2',
          quoteResponseId: 'q-2',
          quoteLineItemId: 'ql-21',
          unitPrice: 37,
          status: 'DECLINED',
        }),
      ],
    },
    {
      rfqLineItemId: 'li-2',
      materialName: 'Glass Panes',
      quantity: 500,
      unit: 'meters',
      projectId: 'p-2',
      projectName: 'Project Two',
      lowestVendorId: 'v-1',
      cells: [
        cell({ quoteLineItemId: 'ql-2', status: 'APPROVED' }),
        cell({
          vendorId: 'v-2',
          quoteResponseId: 'q-2',
          quoteLineItemId: null,
          unitPrice: null,
          quotedQuantity: null,
          extendedCost: null,
          lineTotal: null,
          availability: 'NO_QUOTE',
          status: null,
          hasQuote: false,
        }),
      ],
    },
  ],
};

function renderTable(props: Partial<Record<string, unknown>> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onStatusFilterChange = vi.fn();
  const onSortOrderChange = vi.fn();
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <QuoteComparisonTable
          rfqId="rfq-1"
          statusFilter="all"
          onStatusFilterChange={onStatusFilterChange}
          sortOrder="relevance"
          onSortOrderChange={onSortOrderChange}
          statusCounts={{ all: 2, approved: 0, declined: 1 }}
          {...props}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...utils, onStatusFilterChange, onSortOrderChange };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetComparison.mockResolvedValue(comparison);
  mockUpdateLineStatuses.mockResolvedValue({ updated: 1, lineItems: [] });
});

/* ── Tests ──────────────────────────────────────────────────────────────── */

describe('QuoteComparisonTable', () => {
  it('renders vendor column groups and line item rows', async () => {
    renderTable();

    expect(await screen.findByText('Vendor One')).toBeInTheDocument();
    expect(screen.getByText('Vendor Two')).toBeInTheDocument();
    expect(screen.getByText('Rubber Hoses')).toBeInTheDocument();
    expect(screen.getByText('Glass Panes')).toBeInTheDocument();
    // Sub-columns repeat per vendor.
    expect(screen.getAllByText('reviewTable.priceUnit')).toHaveLength(2);
    expect(screen.getAllByText('reviewTable.availableRequested')).toHaveLength(2);
  });

  it('renders a "Not quoted" cell when the vendor skipped the line', async () => {
    renderTable();
    expect(await screen.findByText('reviewTable.notQuoted')).toBeInTheDocument();
  });

  it('shows the vendor footer totals with delivery, shipment and discount', async () => {
    renderTable();

    await screen.findByText('Vendor One');
    expect(screen.getAllByText('reviewTable.totalWithTaxes').length).toBeGreaterThan(0);
    expect(screen.getByText('A$57,585.00')).toBeInTheDocument();
    expect(screen.getByText('A$61,000.00')).toBeInTheDocument();
    expect(screen.getByText('reviewTable.shipmentHandling')).toBeInTheDocument();
    expect(screen.getByText('8%')).toBeInTheDocument();
  });

  it('approves a pending line from the actions column', async () => {
    renderTable();

    await screen.findByText('Vendor One');
    const approveButtons = screen.getAllByTitle('reviewTable.approveLine');
    fireEvent.click(approveButtons[0]);

    await waitFor(() =>
      expect(mockUpdateLineStatuses).toHaveBeenCalledWith('rfq-1', 'q-1', ['ql-1'], 'APPROVED'),
    );
  });

  it('hides a vendor and shows the hidden banner with Show all', async () => {
    renderTable();

    await screen.findByText('Vendor One');
    fireEvent.click(screen.getAllByTitle('reviewTable.hideVendor')[0]);

    expect(screen.queryByText('Vendor One')).not.toBeInTheDocument();
    expect(screen.getByText('reviewTable.vendorHidden:1')).toBeInTheDocument();

    fireEvent.click(screen.getByText('reviewTable.showAll'));
    expect(await screen.findByText('Vendor One')).toBeInTheDocument();
  });

  it('groups rows by project with subtotal rows', async () => {
    renderTable();

    await screen.findByText('Vendor One');
    fireEvent.click(screen.getByText('reviewTable.group'));
    fireEvent.click(screen.getByText('reviewTable.groupByProjects'));

    expect(screen.getByText('Project One')).toBeInTheDocument();
    expect(screen.getByText('Project Two')).toBeInTheDocument();
    expect(screen.getAllByText('reviewTable.subtotal')).toHaveLength(2);
  });

  it('declined filter shows only declined vendors with restore and select-all', async () => {
    renderTable({ statusFilter: 'declined' });

    await screen.findByText('Vendor Two');
    expect(screen.queryByText('Vendor One')).not.toBeInTheDocument();
    expect(screen.getByText('reviewTable.selectAll')).toBeInTheDocument();

    const restore = screen.getAllByTitle('reviewTable.restoreLine');
    fireEvent.click(restore[0]);
    await waitFor(() =>
      expect(mockUpdateLineStatuses).toHaveBeenCalledWith('rfq-1', 'q-2', ['ql-21'], 'PENDING'),
    );
  });

  it('declined filter: selecting an item shows the banner with Restore all', async () => {
    renderTable({ statusFilter: 'declined' });

    await screen.findByText('Vendor Two');
    fireEvent.click(screen.getAllByTitle('reviewTable.selectLine')[0]);

    expect(screen.getByText('reviewTable.itemsSelected:1')).toBeInTheDocument();
    expect(screen.getByText('reviewTable.restoreAll')).toBeInTheDocument();
  });

  it('approved filter shows the Order column and Award & split / Create Bulk on selection', async () => {
    const approvedComparison = {
      ...comparison,
      vendors: [{ ...comparison.vendors[0], status: 'APPROVED' }],
      rows: comparison.rows.map((row) => ({
        ...row,
        cells: row.cells
          .filter((c) => c.quoteResponseId === 'q-1')
          .map((c) => ({ ...c, status: 'APPROVED' })),
      })),
    };
    mockGetComparison.mockResolvedValue(approvedComparison);
    renderTable({ statusFilter: 'approved' });

    await screen.findByText('Vendor One');
    expect(screen.getAllByText('reviewTable.order').length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByTitle('reviewTable.selectLine')[0]);
    expect(screen.getByText('reviewTable.awardSplit')).toBeInTheDocument();
    expect(screen.getByText('reviewTable.createBulk')).toBeInTheDocument();

    // Award & split → calls awardSplit with the selected line's allocation
    // (US 5.19); the order qty defaults to the full quoted quantity.
    mockAwardSplit.mockResolvedValue({ parentPoId: 'po-p', parentPoNumber: 'PO-1', children: [] });
    fireEvent.click(screen.getByText('reviewTable.awardSplit'));
    await waitFor(() => expect(mockAwardSplit).toHaveBeenCalled());
    expect(mockAwardSplit.mock.calls[0][0]).toBe('rfq-1');
    expect(mockAwardSplit.mock.calls[0][1]).toMatchObject({
      allocations: [{ quoteResponseId: 'q-1', quoteLineItemId: 'ql-1', approvedQuantity: 500 }],
    });
  });

  it('blocks the split award when the cross-vendor approved qty exceeds the requested qty (AC 4)', async () => {
    // Two vendors both quote the same RFQ line (requested 500); the row carries
    // both approved cells so selecting both over-allocates the line.
    const overComparison = {
      ...comparison,
      vendors: [
        { ...comparison.vendors[0], status: 'APPROVED' },
        { ...comparison.vendors[1], status: 'APPROVED' },
      ],
      rows: [
        {
          ...comparison.rows[0],
          cells: [
            cell({ quoteLineItemId: 'ql-1', status: 'APPROVED' }),
            cell({
              vendorId: 'v-2',
              quoteResponseId: 'q-2',
              quoteLineItemId: 'ql-21',
              status: 'APPROVED',
            }),
          ],
        },
      ],
    };
    mockGetComparison.mockResolvedValue(overComparison);
    renderTable({ statusFilter: 'approved' });

    await screen.findByText('Vendor One');
    // Select both vendors' approved cells for the same line (500 + 500 > 500).
    screen.getAllByTitle('reviewTable.selectLine').forEach((el) => fireEvent.click(el));

    expect(screen.getByText('reviewTable.overAllocatedWarning')).toBeInTheDocument();
    fireEvent.click(screen.getByText('reviewTable.awardSplit'));
    expect(mockAwardSplit).not.toHaveBeenCalled();
  });

  it('opens the table management modal from the gear button', async () => {
    renderTable();

    await screen.findByText('Vendor One');
    fireEvent.click(screen.getByTitle('tableManagement.title'));
    expect(screen.getByText('reviewTable.tableManagementSubtitle')).toBeInTheDocument();
    expect(screen.getByText('tableManagement.configureColumns')).toBeInTheDocument();
  });

  it('quote-level approve from the footer opens the PO creation prompt', async () => {
    mockApproveQuote.mockResolvedValue({});
    renderTable();

    await screen.findByText('Vendor One');
    fireEvent.click(screen.getByText('responsesTab.approve'));

    await waitFor(() => expect(mockApproveQuote).toHaveBeenCalledWith('rfq-1', 'q-1'));
    expect(await screen.findByText('startOrder.poTitle')).toBeInTheDocument();
  });
});
