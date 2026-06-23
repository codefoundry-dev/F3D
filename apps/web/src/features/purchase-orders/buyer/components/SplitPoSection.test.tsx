import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

import { SplitPoSection } from './SplitPoSection';

const mockIssue = vi.hoisted(() => vi.fn());
const mockSuccess = vi.hoisted(() => vi.fn());
const mockError = vi.hoisted(() => vi.fn());
const mockInfo = vi.hoisted(() => vi.fn());

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/api-client', () => ({
  issuePurchaseOrder: mockIssue,
}));

vi.mock('@forethread/ui-components', () => ({
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Button: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
  formatCurrency: (n: number, c: string) => `${c} ${n}`,
  notificationService: { success: mockSuccess, error: mockError, info: mockInfo },
}));

vi.mock('react-router-dom', () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}));

vi.mock('@/app/route-config', () => ({
  ROUTES: { purchaseOrderDetail: '/purchase-orders/:id' },
}));

function renderWithClient(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

// Minimal PoDetail-shaped fixture (only the fields SplitPoSection reads).
function po(overrides: Record<string, unknown> = {}) {
  return {
    id: 'parent-1',
    poNumber: 'PO-00010',
    poType: 'SPLIT',
    parentPoId: null,
    parentPoNumber: null,
    currency: 'AUD',
    childPos: [
      {
        id: 'child-1',
        poNumber: 'PO-00010-1',
        status: 'DRAFT',
        totalAmount: 60,
        lineItemCount: 1,
        vendor: { id: 'v-a', name: 'Vendor A' },
      },
      {
        id: 'child-2',
        poNumber: 'PO-00010-2',
        status: 'DRAFT',
        totalAmount: 48,
        lineItemCount: 1,
        vendor: { id: 'v-b', name: 'Vendor B' },
      },
    ],
    ...overrides,
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: issuing a child sends it straight to the vendor (DRAFT → SENT).
  mockIssue.mockResolvedValue({ status: 'SENT' });
});

describe('SplitPoSection', () => {
  it('lists each per-vendor child PO on a SPLIT parent', () => {
    renderWithClient(<SplitPoSection po={po()} />);
    expect(screen.getByText('split.childrenTitle')).toBeInTheDocument();
    expect(screen.getByText('PO-00010-1')).toBeInTheDocument();
    expect(screen.getByText('PO-00010-2')).toBeInTheDocument();
    expect(screen.getByText('Vendor A')).toBeInTheDocument();
    expect(screen.getByText('Vendor B')).toBeInTheDocument();
  });

  it('issues every DRAFT child when "Issue all" is clicked', async () => {
    renderWithClient(<SplitPoSection po={po()} />);
    fireEvent.click(screen.getByText('split.issueAll'));
    await waitFor(() => expect(mockIssue).toHaveBeenCalledTimes(2));
    expect(mockIssue).toHaveBeenCalledWith('child-1');
    expect(mockIssue).toHaveBeenCalledWith('child-2');
    await waitFor(() => expect(mockSuccess).toHaveBeenCalledWith('split.issuedAll'));
  });

  it('reports an info toast when a child is held for approval instead of sent', async () => {
    // First child goes to the vendor, second is over the issuer's limit → held.
    mockIssue.mockResolvedValueOnce({ status: 'SENT' });
    mockIssue.mockResolvedValueOnce({ status: 'PENDING_APPROVAL' });
    renderWithClient(<SplitPoSection po={po()} />);
    fireEvent.click(screen.getByText('split.issueAll'));
    // Both children are still attempted — a held child must not abort the batch.
    await waitFor(() => expect(mockIssue).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(mockInfo).toHaveBeenCalledWith('split.issuedPartial'));
    expect(mockSuccess).not.toHaveBeenCalled();
  });

  it('reports an error toast but still issues the other child when one fails', async () => {
    mockIssue.mockResolvedValueOnce({ status: 'SENT' });
    mockIssue.mockRejectedValueOnce(new Error('boom'));
    renderWithClient(<SplitPoSection po={po()} />);
    fireEvent.click(screen.getByText('split.issueAll'));
    // The first child still gets issued even though the second rejects.
    await waitFor(() => expect(mockIssue).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(mockError).toHaveBeenCalledWith('split.issuedWithErrors'));
  });

  it('hides "Issue all" when no child is still a draft', () => {
    renderWithClient(
      <SplitPoSection
        po={po({
          childPos: [
            {
              id: 'child-1',
              poNumber: 'PO-00010-1',
              status: 'SENT',
              totalAmount: 60,
              lineItemCount: 1,
              vendor: { id: 'v-a', name: 'Vendor A' },
            },
          ],
        })}
      />,
    );
    expect(screen.queryByText('split.issueAll')).not.toBeInTheDocument();
  });

  it('links a split child back to its parent', () => {
    renderWithClient(
      <SplitPoSection
        po={po({
          id: 'child-1',
          poType: 'STANDARD',
          parentPoId: 'parent-1',
          parentPoNumber: 'PO-00010',
          childPos: [],
        })}
      />,
    );
    expect(screen.getByText('split.partOfTitle')).toBeInTheDocument();
    const link = screen.getByText('split.partOfLink').closest('a');
    expect(link).toHaveAttribute('href', '/purchase-orders/parent-1');
  });

  it('renders nothing for a plain standalone PO', () => {
    const { container } = renderWithClient(
      <SplitPoSection
        po={po({ id: 'po-x', poType: 'STANDARD', parentPoId: null, childPos: [] })}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
