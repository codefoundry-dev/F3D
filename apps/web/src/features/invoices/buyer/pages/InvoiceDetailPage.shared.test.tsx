import type { InvoiceDetail } from '@forethread/api-client';
import { InvoiceDetailPage } from '@forethread/invoice-shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

const { mockGetInvoice } = vi.hoisted(() => ({
  mockGetInvoice: vi.fn(),
}));

vi.mock('@forethread/api-client', () => ({
  getInvoice: (...args: unknown[]) => mockGetInvoice(...args),
  // Pulled in by the invoice-shared barrel.
  getMe: vi.fn(),
  getCompanyVendors: vi.fn(),
  getProjects: vi.fn(),
  getPurchaseOrders: vi.fn(),
  getInvoicePoMatch: vi.fn(),
  reviewInvoice: vi.fn(),
  getInvoices: vi.fn(),
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

vi.mock('@forethread/rfq-shared', () => ({
  usePageTitleStore: (selector: (s: { setTitle: () => void }) => unknown) =>
    selector({ setTitle: vi.fn() }),
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'inv-1' }),
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
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
    extraction: null,
    createdAt: '2026-07-28T08:00:00.000Z',
    updatedAt: '2026-07-28T08:00:00.000Z',
    documents: [],
    ...overrides,
  };
}

async function findActionButton(label: string): Promise<HTMLButtonElement> {
  const text = await screen.findByText(label);
  return text.closest('button') as HTMLButtonElement;
}

describe('InvoiceDetailPage (shared) approve readiness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('disables Approve with a hint while vendor, project, or amount is unsaved', async () => {
    // Intake invoice whose review never persisted the approve-critical trio —
    // the server would refuse, so the button must not offer a dead end.
    mockGetInvoice.mockResolvedValue(makeInvoice());

    render(<InvoiceDetailPage canApprove canReview={false} />, { wrapper });

    const approve = await findActionButton('Approve');
    expect(approve).toBeDisabled();
    expect(approve.getAttribute('title')).toContain('vendor, project, and total amount');

    // Declining a not-yet-reviewed invoice is still legitimate.
    expect(await findActionButton('Decline')).toBeEnabled();
  });

  it('enables Approve once vendor, project, and amount are all saved', async () => {
    mockGetInvoice.mockResolvedValue(
      makeInvoice({
        vendorName: 'DAMOS Pty Ltd',
        projectId: 'p-1',
        projectName: 'Plant Upgrade',
        totalAmount: 110,
      }),
    );

    render(<InvoiceDetailPage canApprove canReview={false} />, { wrapper });

    const approve = await findActionButton('Approve');
    expect(approve).toBeEnabled();
    expect(approve.getAttribute('title')).toBeNull();
  });
});
