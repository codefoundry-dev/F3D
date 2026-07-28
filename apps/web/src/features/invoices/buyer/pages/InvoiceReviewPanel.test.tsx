import type { InvoiceDetail } from '@forethread/api-client';
import { InvoiceReviewPanel } from '@forethread/invoice-shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

const { mockGetMe, mockGetCompanyVendors, mockGetProjects, mockReviewInvoice } = vi.hoisted(() => ({
  mockGetMe: vi.fn(),
  mockGetCompanyVendors: vi.fn(),
  mockGetProjects: vi.fn(),
  mockReviewInvoice: vi.fn(),
}));

vi.mock('@forethread/api-client', () => ({
  getMe: (...args: unknown[]) => mockGetMe(...args),
  getCompanyVendors: (...args: unknown[]) => mockGetCompanyVendors(...args),
  getProjects: (...args: unknown[]) => mockGetProjects(...args),
  reviewInvoice: (...args: unknown[]) => mockReviewInvoice(...args),
  // Pulled in by the rest of the invoice-shared barrel.
  getInvoices: vi.fn(),
  getInvoice: vi.fn(),
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
    t: (_key: string, options?: { defaultValue?: string } & Record<string, unknown>) =>
      options?.defaultValue ?? _key,
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

describe('InvoiceReviewPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMe.mockResolvedValue({ id: 'u-1', companyId: 'comp-1' });
    mockGetCompanyVendors.mockResolvedValue([{ id: 'v-1', legalName: 'DAMOS Pty Ltd' }]);
    mockGetProjects.mockResolvedValue({
      items: [{ id: 'p-1', name: 'Plant Upgrade' }],
      meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
    });
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
      },
    ]);
  });

  it('adds and removes line rows', async () => {
    render(<InvoiceReviewPanel invoice={makeInvoice()} />, { wrapper });
    await screen.findByTestId('invoice-review-panel');

    fireEvent.click(screen.getByTestId('invoice-review-add-line'));
    expect(screen.getByTestId('invoice-review-lines').children).toHaveLength(2);

    fireEvent.click(screen.getAllByLabelText('Remove line')[1]);
    expect(screen.getByTestId('invoice-review-lines').children).toHaveLength(1);
  });
});
