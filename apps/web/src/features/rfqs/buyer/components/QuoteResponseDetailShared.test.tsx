import { QuoteResponseActions, QuoteResponseDetailPage } from '@forethread/rfq-shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/* ── Mocks ──────────────────────────────────────────────────────────────── */

const mockGetQuoteDetail = vi.hoisted(() => vi.fn());
const mockGetComparison = vi.hoisted(() => vi.fn());
const mockUpdateLineStatuses = vi.hoisted(() => vi.fn());
const mockApproveQuote = vi.hoisted(() => vi.fn());
const mockDeclineQuote = vi.hoisted(() => vi.fn());

vi.mock('@forethread/api-client', () => ({
  getQuoteDetail: mockGetQuoteDetail,
  getRfqQuoteComparison: mockGetComparison,
  updateQuoteLineItemStatuses: mockUpdateLineStatuses,
  approveQuote: mockApproveQuote,
  declineQuote: mockDeclineQuote,
  createPurchaseOrder: vi.fn(),
  createBulkOrder: vi.fn(),
  awardQuote: vi.fn(),
  getRfqs: vi.fn(),
  getRfq: vi.fn(),
  getRfqEmailLog: vi.fn(),
  getRfqQuoteAudit: vi.fn(),
  openFileInNewTab: vi.fn(),
}));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts && 'count' in opts ? `${key}:${String(opts.count)}` : key,
  }),
}));

/* ── Fixtures ───────────────────────────────────────────────────────────── */

function quoteLine(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'ql-1',
    rfqLineItemId: 'li-1',
    unitPrice: 49,
    quotedQuantity: 500,
    availability: 'AVAILABLE',
    deliveryDate: '2024-12-15T00:00:00.000Z',
    substituteItemId: null,
    substituteItem: null,
    rfqLineItem: {
      id: 'li-1',
      materialName: 'Rubber Hoses (3/4" diameter)',
      quantity: 500,
      unit: 'meters',
      material: null,
    },
    discount: 5,
    discountType: 'PERCENT',
    tax: 10,
    taxIncluded: false,
    backOrderQty: null,
    backOrderDeliveryDate: null,
    notes: null,
    lineTotal: 20707.2,
    status: 'PENDING',
    ...overrides,
  };
}

const quoteDetail = {
  id: 'q-1',
  rfqId: 'rfq-1',
  vendorId: 'v-1',
  vendor: { id: 'v-1', legalName: 'Vendor One' },
  totalCost: 57585,
  discountPercent: 5,
  discountAmount: null,
  itemsCovered: 2,
  totalItems: 2,
  status: 'SUBMITTED',
  submittedAt: '2026-06-01T00:00:00.000Z',
  bulkDeliveryTime: '2026-01-25T00:00:00.000Z',
  bulkDiscount: 5,
  bulkTax: 10,
  bulkShipment: 850,
  warehouseLocationId: null,
  validityPeriod: null,
  message: null,
  lineItems: [
    quoteLine(),
    quoteLine({
      id: 'ql-2',
      rfqLineItemId: 'li-2',
      unitPrice: 72,
      substituteItemId: 'mat-9',
      substituteItem: { id: 'mat-9', name: 'Oak Planks (1" thick)', uom: 'meters' },
      rfqLineItem: {
        id: 'li-2',
        materialName: 'Oak Planks (2" thick)',
        quantity: 500,
        unit: 'meters',
        material: null,
      },
      lineTotal: 20929.2,
    }),
  ],
  attachments: [
    {
      id: 'att-1',
      fileId: 'file-1',
      filename: 'Business License 2025.pdf',
      mimeType: 'application/pdf',
      size: 1000,
    },
  ],
};

const comparison = {
  rfqId: 'rfq-1',
  currency: 'AUD',
  vendors: [],
  rows: [
    {
      rfqLineItemId: 'li-1',
      materialName: 'Rubber Hoses (3/4" diameter)',
      quantity: 500,
      unit: 'meters',
      projectId: 'p-1',
      projectName: 'Project One',
      lowestVendorId: 'v-1',
      cells: [
        {
          vendorId: 'v-1',
          quoteResponseId: 'q-1',
          quoteLineItemId: 'ql-1',
          isLowest: true,
          hasQuote: true,
        },
      ],
    },
  ],
};

function renderDetail(props: Partial<Record<string, unknown>> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <QuoteResponseDetailPage
          rfqId="rfq-1"
          quoteId="q-1"
          vendorName="Vendor One"
          status="SUBMITTED"
          initialTab="lineItems"
          {...props}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetQuoteDetail.mockResolvedValue(quoteDetail);
  mockGetComparison.mockResolvedValue(comparison);
  mockUpdateLineStatuses.mockResolvedValue({ updated: 1, lineItems: [] });
});

/* ── Tests ──────────────────────────────────────────────────────────────── */

describe('QuoteResponseDetailPage (shared)', () => {
  it('renders the quote line items with vendor pricing', async () => {
    renderDetail();

    expect(await screen.findByText('Rubber Hoses (3/4" diameter)')).toBeInTheDocument();
    expect(screen.getByText('A$49.00')).toBeInTheDocument();
    expect(screen.getAllByText('500/500 meters').length).toBeGreaterThan(0);
    expect(screen.getByText('A$20,707.20')).toBeInTheDocument();
    expect(screen.getAllByText('12/15/2024').length).toBeGreaterThan(0);
  });

  it('renders the suggestion-replace section with original and substitute rows', async () => {
    renderDetail();

    expect(await screen.findByText('quoteResponseDetail.suggestionReplace')).toBeInTheDocument();
    // Original (struck through) and the substitute replacement both render.
    expect(screen.getByText('Oak Planks (2" thick)')).toBeInTheDocument();
    expect(screen.getByText('Oak Planks (1" thick)')).toBeInTheDocument();
  });

  it('approves the substitute suggestion from the band actions', async () => {
    renderDetail();

    await screen.findByText('quoteResponseDetail.suggestionReplace');
    const approveButtons = screen.getAllByText('responsesTab.approve');
    // The band has its own approve; header actions are also rendered.
    fireEvent.click(approveButtons[approveButtons.length - 1]);

    await waitFor(() =>
      expect(mockUpdateLineStatuses).toHaveBeenCalledWith('rfq-1', 'q-1', ['ql-2'], 'APPROVED'),
    );
  });

  it('shows the totals footer with delivery, shipment & handling, discount and total', async () => {
    renderDetail();

    expect(await screen.findByText('quoteResponseDetail.totalWithTaxes')).toBeInTheDocument();
    expect(screen.getByText('A$57,585.00')).toBeInTheDocument();
    expect(screen.getByText('quoteResponseDetail.shipmentHandling')).toBeInTheDocument();
    expect(screen.getByText('A$850.00')).toBeInTheDocument();
    expect(screen.getByText('Jan 25, 2026')).toBeInTheDocument();
  });

  it('lists vendor attachments on the attachments tab', async () => {
    renderDetail({ initialTab: 'attachments' });

    expect(await screen.findByText('Business License 2025.pdf')).toBeInTheDocument();
  });

  it('panel layout renders the back arrow and vendor heading', async () => {
    const onBack = vi.fn();
    renderDetail({ layout: 'panel', onBack, hideActions: true });

    expect(await screen.findByText('Vendor One')).toBeInTheDocument();
    const backBtn = document.querySelector('button');
    expect(backBtn).not.toBeNull();
    fireEvent.click(backBtn!);
    expect(onBack).toHaveBeenCalled();
  });
});

describe('QuoteResponseActions post-approve prompt', () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const tree = (status: string) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <QuoteResponseActions rfqId="rfq-1" quoteId="q-1" vendorId="v-1" status={status} />
      </MemoryRouter>
    </QueryClientProvider>
  );

  it('keeps the PO prompt mounted after the quote flips to APPROVED on refetch', async () => {
    mockApproveQuote.mockResolvedValue({});
    const { rerender } = render(tree('SUBMITTED'));

    fireEvent.click(screen.getByText('responsesTab.approve'));

    // The prompt opens once the approval resolves.
    expect(await screen.findByText('startOrder.poTitle')).toBeInTheDocument();

    // Simulate the cache invalidation refetching the quote as APPROVED. The
    // component re-renders non-pending, but the prompt must NOT be unmounted
    // (regression guard for the "prompt flashes shut" bug).
    rerender(tree('APPROVED'));

    expect(screen.getByText('startOrder.poTitle')).toBeInTheDocument();
    // The Decline/Approve buttons are hidden once the quote is no longer pending.
    expect(screen.queryByText('responsesTab.approve')).not.toBeInTheDocument();
  });
});
