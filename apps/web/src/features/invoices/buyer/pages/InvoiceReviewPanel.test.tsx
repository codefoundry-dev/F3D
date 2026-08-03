import type { InvoiceDetail, InvoicePoMatchResult } from '@forethread/api-client';
import { InvoiceReviewPanel } from '@forethread/invoice-shared';
import { notificationService } from '@forethread/ui-components';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';

const {
  mockGetMe,
  mockGetCompanyVendors,
  mockGetProjects,
  mockGetPurchaseOrders,
  mockGetInvoicePoMatch,
  mockReviewInvoice,
} = vi.hoisted(() => ({
  mockGetMe: vi.fn(),
  mockGetCompanyVendors: vi.fn(),
  mockGetProjects: vi.fn(),
  mockGetPurchaseOrders: vi.fn(),
  mockGetInvoicePoMatch: vi.fn(),
  mockReviewInvoice: vi.fn(),
}));

vi.mock('@forethread/api-client', () => ({
  getMe: (...args: unknown[]) => mockGetMe(...args),
  getCompanyVendors: (...args: unknown[]) => mockGetCompanyVendors(...args),
  getProjects: (...args: unknown[]) => mockGetProjects(...args),
  getPurchaseOrders: (...args: unknown[]) => mockGetPurchaseOrders(...args),
  getInvoicePoMatch: (...args: unknown[]) => mockGetInvoicePoMatch(...args),
  reviewInvoice: (...args: unknown[]) => mockReviewInvoice(...args),
  // Pulled in by the rest of the invoice-shared barrel.
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
    // Interpolates {{placeholders}} so flag badges assert naturally.
    t: (_key: string, options?: { defaultValue?: string } & Record<string, unknown>) => {
      const template = options?.defaultValue ?? _key;
      return template.replace(/\{\{(\w+)\}\}/gu, (_, name: string) =>
        String((options?.[name] as string | number | undefined) ?? ''),
      );
    },
  }),
}));

vi.mock('@forethread/rfq-shared', () => ({
  usePageTitleStore: (selector: (s: { setTitle: () => void }) => unknown) =>
    selector({ setTitle: vi.fn() }),
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function makeInvoice(overrides: Partial<InvoiceDetail> = {}): InvoiceDetail {
  return {
    id: 'inv-1',
    projectName: null,
    projectId: null,
    vendorName: null,
    status: 'PENDING',
    source: 'EMAIL',
    senderEmail: 'accounts@damos.com',
    relatedPo: null,
    relatedPoNumber: null,
    totalAmount: null,
    dueDate: null,
    invoiceNumber: null,
    issuedDate: null,
    reviewedAt: null,
    lines: [],
    extraction: {
      id: 'ext-1',
      status: 'COMPLETED',
      errorCode: null,
      completedAt: '2026-07-28T09:00:00.000Z',
      result: {
        vendorName: 'DAMOS',
        invoiceNumber: 'I209927',
        poReferences: ['PO-2026-001'],
        issuedDate: '2026-07-01',
        dueDate: '2026-07-31',
        paymentTerms: 'Net 30',
        currency: 'AUD',
        subTotal: 100,
        taxLabel: 'GST 10%',
        taxRate: 10,
        taxAmount: 10,
        totalAmount: 110,
        items: [
          {
            lineId: '1',
            description: 'DN100 PVC pipe',
            quantity: 12,
            unit: 'm',
            unitPrice: 8.5,
            lineTotal: 102,
          },
        ],
        notes: null,
      },
    },
    createdAt: '2026-07-28T08:00:00.000Z',
    updatedAt: '2026-07-28T08:00:00.000Z',
    documents: [],
    ...overrides,
  };
}

/** Invoice↔PO match report (FOR-293); defaults to an auto-matched PO with no saved lines. */
function makeMatch(overrides: Partial<InvoicePoMatchResult> = {}): InvoicePoMatchResult {
  return {
    resolution: 'AUTO_MATCHED',
    po: {
      id: 'po-1',
      poNumber: 'PO-00042',
      status: 'SENT',
      vendorId: 'v-1',
      vendorName: 'DAMOS Pty Ltd',
      projectId: 'p-1',
      totalAmount: 110,
    },
    poCandidates: [],
    poReferences: ['PO-2026-001'],
    vendorMismatch: false,
    lines: [],
    unbilledPoLines: [],
    thresholds: { priceTolerancePct: 2, quantityTolerance: 0 },
    summary: {
      lineCount: 0,
      matchedCount: 0,
      priceVarianceCount: 0,
      quantityVarianceCount: 0,
      unexpectedCount: 0,
    },
    ...overrides,
  };
}

describe('InvoiceReviewPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMe.mockResolvedValue({ id: 'u-1', companyId: 'comp-1' });
    mockGetCompanyVendors.mockResolvedValue([{ id: 'v-1', legalName: 'DAMOS Pty Ltd' }]);
    mockGetProjects.mockResolvedValue({
      items: [{ id: 'p-1', name: 'Plant Upgrade' }],
      meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
    });
    mockGetPurchaseOrders.mockResolvedValue({
      items: [{ id: 'po-1', poNumber: 'PO-00042' }],
      meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
    });
    mockGetInvoicePoMatch.mockResolvedValue(makeMatch());
    mockReviewInvoice.mockResolvedValue(makeInvoice());
  });

  it('prefills the form from the completed extraction', async () => {
    render(<InvoiceReviewPanel invoice={makeInvoice()} />, { wrapper });

    expect(await screen.findByTestId('invoice-review-panel')).toBeInTheDocument();
    expect(screen.getByTestId('invoice-review-number')).toHaveValue('I209927');
    expect(screen.getByTestId('invoice-review-total')).toHaveValue('110');
    expect(screen.getByDisplayValue('DN100 PVC pipe')).toBeInTheDocument();
  });

  it('shows only the progress banner while the extraction is still running', () => {
    render(
      <InvoiceReviewPanel
        invoice={makeInvoice({
          extraction: {
            id: 'ext-1',
            status: 'PROCESSING',
            errorCode: null,
            completedAt: null,
            result: null,
          },
        })}
      />,
      { wrapper },
    );

    expect(screen.getByTestId('invoice-review-extracting')).toBeInTheDocument();
    expect(screen.queryByTestId('invoice-review-panel')).not.toBeInTheDocument();
  });

  it('offers manual entry when the extraction failed', async () => {
    render(
      <InvoiceReviewPanel
        invoice={makeInvoice({
          extraction: {
            id: 'ext-1',
            status: 'FAILED',
            errorCode: 'TIMEOUT',
            completedAt: '2026-07-28T09:00:00.000Z',
            result: null,
          },
        })}
      />,
      { wrapper },
    );

    expect(await screen.findByTestId('invoice-review-extraction-failed')).toBeInTheDocument();
    // The blank form still renders so details can be typed in by hand.
    expect(screen.getByTestId('invoice-review-panel')).toBeInTheDocument();
    expect(screen.getByTestId('invoice-review-no-lines')).toBeInTheDocument();
  });

  it('saves the corrected fields, auto-matching the extracted vendor name', async () => {
    render(<InvoiceReviewPanel invoice={makeInvoice()} />, { wrapper });
    await screen.findByTestId('invoice-review-panel');

    // The vendor list resolves async; the extracted name should auto-select it.
    await waitFor(() => expect(mockGetCompanyVendors).toHaveBeenCalled());

    fireEvent.change(screen.getByTestId('invoice-review-number'), {
      target: { value: 'I209927-A' },
    });
    fireEvent.click(screen.getByTestId('invoice-review-save'));

    await waitFor(() => expect(mockReviewInvoice).toHaveBeenCalledTimes(1));
    const [id, payload] = mockReviewInvoice.mock.calls[0] as [string, Record<string, unknown>];
    expect(id).toBe('inv-1');
    expect(payload).toMatchObject({
      vendorId: 'v-1',
      invoiceNumber: 'I209927-A',
      issuedDate: '2026-07-01',
      dueDate: '2026-07-31',
      totalAmount: 110,
    });
    expect(payload.lines).toEqual([
      {
        lineId: '1',
        description: 'DN100 PVC pipe',
        quantity: 12,
        unit: 'm',
        unitPrice: 8.5,
        lineTotal: 102,
        // Accounting coding is reviewer-entered, never extracted (FOR-295).
        costCode: null,
        glAccount: null,
      },
    ]);
  });

  // ── Cost code + GL account per line (FOR-295) ──────────────────────────────

  it('saves reviewer-entered cost code and GL account per line', async () => {
    render(<InvoiceReviewPanel invoice={makeInvoice()} />, { wrapper });
    await screen.findByTestId('invoice-review-panel');

    fireEvent.change(screen.getByLabelText('Cost code'), { target: { value: ' 03-100 ' } });
    fireEvent.change(screen.getByLabelText('GL account'), { target: { value: '5010' } });
    fireEvent.click(screen.getByTestId('invoice-review-save'));

    await waitFor(() => expect(mockReviewInvoice).toHaveBeenCalledTimes(1));
    const [, payload] = mockReviewInvoice.mock.calls[0] as [string, Record<string, unknown>];
    expect(payload.lines).toMatchObject([{ costCode: '03-100', glAccount: '5010' }]);
  });

  it('seeds cost code and GL account from the saved lines', async () => {
    render(
      <InvoiceReviewPanel
        invoice={makeInvoice({
          reviewedAt: '2026-07-28T10:00:00.000Z',
          lines: [
            {
              id: 'il-1',
              lineId: '1',
              description: 'DN100 PVC pipe',
              quantity: 10,
              unit: 'm',
              unitPrice: 8.5,
              lineTotal: 85,
              costCode: '03-100',
              glAccount: '5010',
            },
          ],
        })}
      />,
      { wrapper },
    );
    await screen.findByTestId('invoice-review-panel');

    expect(screen.getByLabelText('Cost code')).toHaveValue('03-100');
    expect(screen.getByLabelText('GL account')).toHaveValue('5010');
  });

  it('adds and removes line rows', async () => {
    render(<InvoiceReviewPanel invoice={makeInvoice()} />, { wrapper });
    await screen.findByTestId('invoice-review-panel');

    fireEvent.click(screen.getByTestId('invoice-review-add-line'));
    expect(screen.getByTestId('invoice-review-lines').children).toHaveLength(2);

    fireEvent.click(screen.getAllByLabelText('Remove line')[1]);
    expect(screen.getByTestId('invoice-review-lines').children).toHaveLength(1);
  });

  // ── Invoice ↔ PO matching (FOR-293) ────────────────────────────────────────

  it('pre-selects the auto-matched PO and saves it as relatedPoId', async () => {
    render(<InvoiceReviewPanel invoice={makeInvoice()} />, { wrapper });
    await screen.findByTestId('invoice-review-panel');

    // The reconciler resolved the document's reference to PO-00042.
    expect(await screen.findByTestId('invoice-review-match-auto')).toBeInTheDocument();
    // The badge renders straight from the match result; the selection lands in
    // form state one effect later. Wait for the visible pre-selection so save
    // can't race it.
    await within(screen.getByTestId('invoice-review-po')).findByText('PO-00042');

    fireEvent.click(screen.getByTestId('invoice-review-save'));

    await waitFor(() => expect(mockReviewInvoice).toHaveBeenCalledTimes(1));
    const [, payload] = mockReviewInvoice.mock.calls[0] as [string, Record<string, unknown>];
    expect(payload.relatedPoId).toBe('po-1');
  });

  it('warns when the invoice cites no PO reference', async () => {
    mockGetInvoicePoMatch.mockResolvedValue(
      makeMatch({ resolution: 'NO_REFERENCE', po: null, poReferences: [] }),
    );

    render(<InvoiceReviewPanel invoice={makeInvoice()} />, { wrapper });
    await screen.findByTestId('invoice-review-panel');

    expect(await screen.findByTestId('invoice-review-match-no-reference')).toBeInTheDocument();
  });

  it('warns when the cited reference matches no purchase order', async () => {
    mockGetInvoicePoMatch.mockResolvedValue(
      makeMatch({ resolution: 'NOT_FOUND', po: null, poReferences: ['PO 999'] }),
    );

    render(<InvoiceReviewPanel invoice={makeInvoice()} />, { wrapper });
    await screen.findByTestId('invoice-review-panel');

    const banner = await screen.findByTestId('invoice-review-match-not-found');
    expect(banner).toHaveTextContent('PO 999');
  });

  it('renders per-line variance flags and the issues summary for saved lines', async () => {
    const savedInvoice = makeInvoice({
      reviewedAt: '2026-07-28T10:00:00.000Z',
      relatedPo: 'po-1',
      relatedPoNumber: 'PO-00042',
      lines: [
        {
          id: 'il-1',
          lineId: '1',
          description: 'DN100 PVC pipe',
          quantity: 10,
          unit: 'm',
          unitPrice: 8.5,
          lineTotal: 85,
          costCode: null,
          glAccount: null,
        },
        {
          id: 'il-2',
          lineId: '2',
          description: 'Weekend crane hire',
          quantity: 1,
          unit: 'ea',
          unitPrice: 500,
          lineTotal: 500,
          costCode: null,
          glAccount: null,
        },
      ],
    });
    const poLine = {
      id: 'pol-1',
      lineNumber: 1,
      materialCode: 'PVC-100',
      description: 'DN100 PVC pipe',
      quantityOrdered: 10,
      quantityDelivered: 10,
      unitOfMeasure: 'm',
      unitPrice: 8.5,
      lineTotal: 85,
    };
    mockGetInvoicePoMatch.mockResolvedValue(
      makeMatch({
        resolution: 'LINKED',
        lines: [
          {
            invoiceLineId: 'il-1',
            position: 0,
            description: 'DN100 PVC pipe',
            quantity: 10,
            unitPrice: 9.35,
            lineTotal: 93.5,
            poLine,
            matchConfidence: 0.7,
            priceVariancePct: 10,
            quantityDelta: 0,
            flags: ['PRICE_VARIANCE'],
          },
          {
            invoiceLineId: 'il-2',
            position: 1,
            description: 'Weekend crane hire',
            quantity: 1,
            unitPrice: 500,
            lineTotal: 500,
            poLine: null,
            matchConfidence: null,
            priceVariancePct: null,
            quantityDelta: null,
            flags: ['NOT_ON_PO'],
          },
        ],
        summary: {
          lineCount: 2,
          matchedCount: 1,
          priceVarianceCount: 1,
          quantityVarianceCount: 0,
          unexpectedCount: 1,
        },
      }),
    );

    render(<InvoiceReviewPanel invoice={savedInvoice} />, { wrapper });
    await screen.findByTestId('invoice-review-panel');

    const summary = await screen.findByTestId('invoice-review-match-issues');
    expect(summary).toHaveTextContent(
      'Checked against PO-00042: 1 of 2 line(s) matched, 1 price variance(s), 0 quantity variance(s), 1 not on the PO.',
    );
    expect(screen.getByText('Price +10%')).toBeInTheDocument();
    expect(screen.getByText('Not on PO')).toBeInTheDocument();
  });

  it('shows the all-clear summary and Matched badges when every line matches', async () => {
    const savedInvoice = makeInvoice({
      reviewedAt: '2026-07-28T10:00:00.000Z',
      relatedPo: 'po-1',
      relatedPoNumber: 'PO-00042',
      lines: [
        {
          id: 'il-1',
          lineId: '1',
          description: 'DN100 PVC pipe',
          quantity: 10,
          unit: 'm',
          unitPrice: 8.5,
          lineTotal: 85,
          costCode: null,
          glAccount: null,
        },
      ],
    });
    mockGetInvoicePoMatch.mockResolvedValue(
      makeMatch({
        resolution: 'LINKED',
        lines: [
          {
            invoiceLineId: 'il-1',
            position: 0,
            description: 'DN100 PVC pipe',
            quantity: 10,
            unitPrice: 8.5,
            lineTotal: 85,
            poLine: {
              id: 'pol-1',
              lineNumber: 1,
              materialCode: 'PVC-100',
              description: 'DN100 PVC pipe',
              quantityOrdered: 10,
              quantityDelivered: 10,
              unitOfMeasure: 'm',
              unitPrice: 8.5,
              lineTotal: 85,
            },
            matchConfidence: 0.7,
            priceVariancePct: 0,
            quantityDelta: 0,
            flags: [],
          },
        ],
        summary: {
          lineCount: 1,
          matchedCount: 1,
          priceVarianceCount: 0,
          quantityVarianceCount: 0,
          unexpectedCount: 0,
        },
      }),
    );

    render(<InvoiceReviewPanel invoice={savedInvoice} />, { wrapper });
    await screen.findByTestId('invoice-review-panel');

    const summary = await screen.findByTestId('invoice-review-match-clean');
    expect(summary).toHaveTextContent('All 1 line(s) match PO-00042 — no variances.');
    expect(screen.getByText('Matched')).toBeInTheDocument();
  });

  // ── Approve-readiness messaging ────────────────────────────────────────────
  // Approval requires vendor + project + amount on the record; a review save
  // that leaves any of them empty must not present itself as complete.

  it('warns instead of showing the green banner when a reviewed invoice is missing approve fields', async () => {
    render(
      <InvoiceReviewPanel
        invoice={makeInvoice({
          reviewedAt: '2026-07-28T10:00:00.000Z',
          vendorName: 'DAMOS Pty Ltd',
          projectId: null, // saved without ever choosing a project
          totalAmount: 110,
        })}
      />,
      { wrapper },
    );
    await screen.findByTestId('invoice-review-panel');

    const banner = screen.getByTestId('invoice-review-incomplete');
    expect(banner).toHaveTextContent('vendor, project, and total amount');
    expect(screen.queryByTestId('invoice-review-reviewed')).not.toBeInTheDocument();
  });

  it('keeps the green reviewed banner when vendor, project, and amount are all saved', async () => {
    render(
      <InvoiceReviewPanel
        invoice={makeInvoice({
          reviewedAt: '2026-07-28T10:00:00.000Z',
          vendorName: 'DAMOS Pty Ltd',
          projectId: 'p-1',
          projectName: 'Plant Upgrade',
          totalAmount: 110,
        })}
      />,
      { wrapper },
    );
    await screen.findByTestId('invoice-review-panel');

    expect(screen.getByTestId('invoice-review-reviewed')).toBeInTheDocument();
    expect(screen.queryByTestId('invoice-review-incomplete')).not.toBeInTheDocument();
  });

  it('saves an incomplete review with an info toast, not a bare success', async () => {
    const infoSpy = vi.spyOn(notificationService, 'info').mockImplementation(() => '');
    const successSpy = vi.spyOn(notificationService, 'success').mockImplementation(() => '');

    // Default fixture: the extraction seeds the total and the vendor
    // auto-matches, but no project is ever chosen.
    render(<InvoiceReviewPanel invoice={makeInvoice()} />, { wrapper });
    await screen.findByTestId('invoice-review-panel');
    fireEvent.click(screen.getByTestId('invoice-review-save'));

    await waitFor(() => expect(mockReviewInvoice).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(infoSpy).toHaveBeenCalled());
    expect(infoSpy.mock.calls[0][0]).toContain('before this invoice can be approved');
    expect(successSpy).not.toHaveBeenCalled();

    infoSpy.mockRestore();
    successSpy.mockRestore();
  });
});
