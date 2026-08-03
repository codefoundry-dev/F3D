import type { InvoiceDetail } from '@forethread/api-client';
import { InvoiceHistoryTab } from '@forethread/invoice-shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

const { mockGetInvoiceAuditTrail } = vi.hoisted(() => ({
  mockGetInvoiceAuditTrail: vi.fn(),
}));

vi.mock('@forethread/api-client', () => ({
  getInvoiceAuditTrail: (...args: unknown[]) => mockGetInvoiceAuditTrail(...args),
  // Pulled in by the rest of the invoice-shared barrel.
  getMe: vi.fn(),
  getCompanyVendors: vi.fn(),
  getProjects: vi.fn(),
  getPurchaseOrders: vi.fn(),
  getInvoicePoMatch: vi.fn(),
  reviewInvoice: vi.fn(),
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
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function makeInvoice(overrides: Partial<InvoiceDetail> = {}): InvoiceDetail {
  return {
    id: 'inv-1',
    projectName: 'Alpha',
    projectId: 'p-1',
    vendorName: 'DAMOS',
    status: 'REJECTED',
    source: 'EMAIL',
    senderEmail: 'accounts@damos.com',
    relatedPo: null,
    relatedPoNumber: null,
    totalAmount: 110,
    dueDate: null,
    invoiceNumber: 'I209927',
    issuedDate: null,
    reviewedAt: '2026-07-28T09:00:00.000Z',
    lines: [],
    extraction: null,
    createdAt: '2026-07-28T08:00:00.000Z',
    updatedAt: '2026-07-28T10:00:00.000Z',
    documents: [],
    ...overrides,
  };
}

describe('InvoiceHistoryTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows received, reviewed, and audited transitions with reason and actor', async () => {
    mockGetInvoiceAuditTrail.mockResolvedValue([
      {
        id: 'log-1',
        action: 'INVOICE_REJECTED',
        metadata: { from: 'PENDING', to: 'REJECTED', reason: 'Wrong amount' },
        performedBy: { id: 'u-1', name: 'Casey Admin', email: 'ca@test.com' },
        createdAt: '2026-07-28T10:00:00.000Z',
      },
    ]);

    render(<InvoiceHistoryTab invoice={makeInvoice()} />, { wrapper });

    await waitFor(() => expect(screen.getByText('Invoice rejected')).toBeInTheDocument());
    expect(screen.getByText('Invoice received')).toBeInTheDocument();
    expect(screen.getByText('From accounts@damos.com')).toBeInTheDocument();
    expect(screen.getByText('Details reviewed')).toBeInTheDocument();
    expect(screen.getByText('By Casey Admin')).toBeInTheDocument();
    expect(screen.getByText('Reason: Wrong amount')).toBeInTheDocument();
  });

  it('ignores unknown audit actions and omits the reviewed entry when never reviewed', async () => {
    mockGetInvoiceAuditTrail.mockResolvedValue([
      {
        id: 'log-2',
        action: 'SOMETHING_ELSE',
        metadata: null,
        performedBy: null,
        createdAt: '2026-07-28T10:00:00.000Z',
      },
    ]);

    render(<InvoiceHistoryTab invoice={makeInvoice({ reviewedAt: null, source: 'MANUAL' })} />, {
      wrapper,
    });

    await waitFor(() => expect(screen.getByText('Invoice received')).toBeInTheDocument());
    expect(screen.queryByText('Details reviewed')).not.toBeInTheDocument();
    expect(screen.queryByText('From accounts@damos.com')).not.toBeInTheDocument();
  });
});
