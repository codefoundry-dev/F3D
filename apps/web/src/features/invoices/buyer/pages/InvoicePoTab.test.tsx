import type { InvoiceDetail, InvoicePoInfoResult } from '@forethread/api-client';
import { InvoicePoTab } from '@forethread/invoice-shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

const { mockGetInvoicePoInfo, mockExportInvoiceRelatedPo } = vi.hoisted(() => ({
  mockGetInvoicePoInfo: vi.fn(),
  mockExportInvoiceRelatedPo: vi.fn(),
}));

vi.mock('@forethread/api-client', () => ({
  getInvoicePoInfo: (...args: unknown[]) => mockGetInvoicePoInfo(...args),
  exportInvoiceRelatedPo: (...args: unknown[]) => mockExportInvoiceRelatedPo(...args),
  // Pulled in by the rest of the invoice-shared barrel.
  getMe: vi.fn(),
  getCompanyVendors: vi.fn(),
  getProjects: vi.fn(),
  getPurchaseOrders: vi.fn(),
  getInvoicePoMatch: vi.fn(),
  reviewInvoice: vi.fn(),
  getInvoices: vi.fn(),
  getInvoice: vi.fn(),
  getInvoiceAuditTrail: vi.fn(),
  getInvoiceIntakeAddress: vi.fn(),
  approveInvoice: vi.fn(),
  rejectInvoice: vi.fn(),
  bulkApproveInvoices: vi.fn(),
  exportInvoices: vi.fn(),
  exportSingleInvoice: vi.fn(),
  uploadInvoice: vi.fn(),
  openFileInNewTab: vi.fn(),
  downloadFile: vi.fn(),
}));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: { defaultValue?: string } & Record<string, unknown>) => {
      const template = options?.defaultValue ?? _key;
      return template.replace(/\{\{(\w+)\}\}/gu, (_, name: string) =>
        String((options?.[name] as string | number | undefined) ?? ''),
      );
    },
  }),
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <MemoryRouter>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
}

function makeInvoice(overrides: Partial<InvoiceDetail> = {}): InvoiceDetail {
  return {
    id: 'inv-1',
    projectName: 'Alpha',
    projectId: 'p-1',
    vendorName: 'DAMOS',
    status: 'PENDING',
    source: 'EMAIL',
    senderEmail: 'accounts@damos.com',
    relatedPo: 'po-1',
    relatedPoNumber: 'PO-00042',
    totalAmount: 110,
    dueDate: null,
    invoiceNumber: 'INV-9',
    issuedDate: null,
    reviewedAt: null,
    lines: [],
    extraction: null,
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-01T08:00:00.000Z',
    documents: [
      {
        id: 'doc-1',
        name: 'invoice.pdf',
        fileId: 'file-1',
        uploadedBy: null,
        uploadedAt: '2026-08-01T08:00:00.000Z',
      },
    ],
    ...overrides,
  };
}

function makePoInfo(overrides: Partial<InvoicePoInfoResult> = {}): InvoicePoInfoResult {
  return {
    match: {
      resolution: 'LINKED',
      po: {
        id: 'po-1',
        poNumber: 'PO-00042',
        status: 'SENT',
        vendorId: 'vendor-1',
        vendorName: 'DAMOS',
        projectId: 'p-1',
        projectName: 'Alpha',
        currency: 'AUD',
        totalAmount: 110,
        delivery: {
          status: 'PARTIALLY_DELIVERED',
          quantityOrdered: 10,
          quantityDelivered: 6,
          linesDelivered: 0,
          lineCount: 1,
          percentDelivered: 60,
          plannedDeliveryDate: null,
        },
      },
      poCandidates: [],
      poReferences: [],
      vendorMismatch: false,
      lines: [],
      poLines: [],
      unbilledPoLines: [],
      thresholds: { priceTolerancePct: 2, quantityTolerance: 0 },
      summary: {
        lineCount: 0,
        matchedCount: 0,
        priceVarianceCount: 0,
        quantityVarianceCount: 0,
        unexpectedCount: 0,
      },
    },
    deliveryReports: [
      {
        id: 'dr-1',
        reportNumber: 'DR-0007',
        status: 'APPROVED',
        source: 'INTERNAL',
        deliveryDate: '2026-08-10T00:00:00.000Z',
        locationName: 'North gate',
        submitterName: 'Sam Site',
        lineCount: 2,
        quantityReceived: 10,
        createdAt: '2026-08-10T08:00:00.000Z',
      },
    ],
    ...overrides,
  };
}

const noPoInfo = (): InvoicePoInfoResult => {
  const info = makePoInfo({ deliveryReports: [] });
  return { ...info, match: { ...info.match, resolution: 'NO_REFERENCE', po: null } };
};

describe('InvoicePoTab (FOR-355)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the PO comparison, delivery rows, and receipt date for a linked invoice', async () => {
    mockGetInvoicePoInfo.mockResolvedValue(makePoInfo());

    render(<InvoicePoTab invoice={makeInvoice()} />, { wrapper });

    // The reused comparison panel resolves with the PO number.
    expect(await screen.findByTestId('invoice-po-comparison')).toBeInTheDocument();
    expect(screen.getByText('PO-00042')).toBeInTheDocument();

    // Delivery report row, linking to the report detail.
    const reportLink = screen.getByRole('link', { name: 'DR-0007' });
    expect(reportLink).toHaveAttribute('href', '/deliveries/dr-1');
    expect(screen.getByText('Sam Site')).toBeInTheDocument();
    expect(screen.getByText('North gate')).toBeInTheDocument();

    // AC5: the supplier document arrived, so no "Invoice not sent".
    expect(screen.getByTestId('invoice-po-tab-receipt')).toHaveTextContent('Received');
    expect(screen.queryByText('Invoice not sent')).not.toBeInTheDocument();
  });

  it('opens the system PO PDF via the invoice-scoped export', async () => {
    mockGetInvoicePoInfo.mockResolvedValue(makePoInfo());
    mockExportInvoiceRelatedPo.mockResolvedValue({ url: 'https://signed/po.pdf' });
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);

    render(<InvoicePoTab invoice={makeInvoice()} />, { wrapper });

    fireEvent.click(await screen.findByTestId('invoice-po-tab-view-pdf'));

    await waitFor(() =>
      expect(mockExportInvoiceRelatedPo).toHaveBeenCalledWith('inv-1', { poId: 'po-1' }),
    );
    await waitFor(() => expect(openSpy).toHaveBeenCalledWith('https://signed/po.pdf', '_blank'));
    openSpy.mockRestore();
  });

  it('shows explicit empty states when no PO resolves and no delivery exists', async () => {
    mockGetInvoicePoInfo.mockResolvedValue(noPoInfo());

    render(<InvoicePoTab invoice={makeInvoice()} />, { wrapper });

    expect(await screen.findByTestId('invoice-po-tab-no-po')).toHaveTextContent(
      'No purchase order is linked to this invoice.',
    );
    // AC4: the absence of a delivery is stated, not implied.
    expect(screen.getByTestId('invoice-po-tab-no-deliveries')).toHaveTextContent(
      'No delivery is available for this invoice yet.',
    );
    // No PO → nothing to export.
    expect(screen.queryByTestId('invoice-po-tab-view-pdf')).not.toBeInTheDocument();
  });

  it('shows the no-delivery empty state even when a PO is linked', async () => {
    mockGetInvoicePoInfo.mockResolvedValue(makePoInfo({ deliveryReports: [] }));

    render(<InvoicePoTab invoice={makeInvoice()} />, { wrapper });

    expect(await screen.findByTestId('invoice-po-comparison')).toBeInTheDocument();
    expect(screen.getByTestId('invoice-po-tab-no-deliveries')).toBeInTheDocument();
  });

  it('flags "Invoice not sent" when the invoice has no supplier document (AC5)', async () => {
    mockGetInvoicePoInfo.mockResolvedValue(makePoInfo());

    render(<InvoicePoTab invoice={makeInvoice({ documents: [] })} />, { wrapper });

    expect(await screen.findByText('Invoice not sent')).toBeInTheDocument();
  });

  it('previews the PO picked in the review form before the review is saved', async () => {
    const info = makePoInfo();
    mockGetInvoicePoInfo.mockResolvedValue({
      ...info,
      match: { ...info.match, resolution: 'SELECTED' },
    });

    render(<InvoicePoTab invoice={makeInvoice({ relatedPo: null })} previewPoId="po-1" />, {
      wrapper,
    });

    expect(await screen.findByTestId('invoice-po-comparison')).toBeInTheDocument();
    // The unsaved pick rides along on the request…
    expect(mockGetInvoicePoInfo).toHaveBeenCalledWith('inv-1', { poId: 'po-1' });
    // …and the tab says the link still needs a save to stick.
    expect(screen.getByTestId('invoice-po-tab-unsaved')).toHaveTextContent(
      'not linked to the invoice yet',
    );
  });

  it('shows no unsaved-link hint for a saved (LINKED) PO', async () => {
    mockGetInvoicePoInfo.mockResolvedValue(makePoInfo());

    render(<InvoicePoTab invoice={makeInvoice()} />, { wrapper });

    expect(await screen.findByTestId('invoice-po-comparison')).toBeInTheDocument();
    expect(screen.queryByTestId('invoice-po-tab-unsaved')).not.toBeInTheDocument();
  });

  it('shows the catalogue image on the PO side of a compared line (FOR-402)', async () => {
    const info = makePoInfo();
    const poLine = {
      id: 'pl-1',
      lineNumber: 1,
      materialCode: 'AB-6061',
      description: 'Aluminum Beam 6061',
      quantityOrdered: 10,
      quantityDelivered: 6,
      unitOfMeasure: 'EA',
      unitPrice: 11,
      lineTotal: 110,
      costCode: null,
    };
    mockGetInvoicePoInfo.mockResolvedValue({
      ...info,
      match: {
        ...info.match,
        poLines: [
          { ...poLine, imageUrl: 'https://cdn.example/beam.png' },
          { ...poLine, id: 'pl-2', lineNumber: 2, description: 'Free-text line', imageUrl: null },
        ],
      },
    });

    render(<InvoicePoTab invoice={makeInvoice()} />, { wrapper });

    const table = await screen.findByTestId('invoice-po-comparison-rows');
    expect(within(table).getByRole('img', { name: 'Aluminum Beam 6061' })).toHaveAttribute(
      'src',
      'https://cdn.example/beam.png',
    );
    // One thumbnail in the table and one in the narrow cards — none for the
    // line whose material has no image.
    expect(within(table).getAllByTestId('material-image-thumb')).toHaveLength(1);
    const cards = screen.getByTestId('invoice-po-comparison-cards');
    expect(within(cards).getAllByTestId('material-image-thumb')).toHaveLength(1);
    expect(within(table).getByText('Free-text line')).toBeInTheDocument();
  });
});
