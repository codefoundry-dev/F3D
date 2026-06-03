import { render, screen } from '@testing-library/react';

const mockUseRfqQuoteAudit = vi.hoisted(() => vi.fn());

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/rfq-shared', () => ({
  useRfqQuoteAudit: mockUseRfqQuoteAudit,
}));

vi.mock('@forethread/ui-components', () => ({
  Spinner: ({ size }: { size?: string }) => <div data-testid="spinner" data-size={size} />,
  formatCurrency: (n: number) => `$${n}`,
  formatDateTime: (s: string) => s,
}));

vi.mock('@forethread/ui-components/assets/icons/checkcircle-icon.svg?react', () => ({
  default: (props: Record<string, unknown>) => <svg data-testid="icon-check" {...props} />,
}));
vi.mock('@forethread/ui-components/assets/icons/clock.svg?react', () => ({
  default: (props: Record<string, unknown>) => <svg data-testid="icon-clock" {...props} />,
}));

import { RfqQuoteAuditTab } from './RfqQuoteAuditTab';

describe('RfqQuoteAuditTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a spinner while loading', () => {
    mockUseRfqQuoteAudit.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    render(<RfqQuoteAuditTab rfqId="rfq-1" />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('renders the empty state when there are no entries', () => {
    mockUseRfqQuoteAudit.mockReturnValue({ data: [], isLoading: false, isError: false });
    render(<RfqQuoteAuditTab rfqId="rfq-1" />);
    expect(screen.getByText('auditTab.noEvents')).toBeInTheDocument();
  });

  it('renders the error state', () => {
    mockUseRfqQuoteAudit.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    render(<RfqQuoteAuditTab rfqId="rfq-1" />);
    expect(screen.getByText('auditTab.loadError')).toBeInTheDocument();
  });

  it('renders audit events with action, source and actor', () => {
    mockUseRfqQuoteAudit.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [
        {
          id: 'audit-1',
          quoteResponseId: 'q-1',
          action: 'SUBMITTED',
          source: 'PDF',
          vendorId: 'v-1',
          vendorName: 'VendorCo',
          performedByName: 'Jane Vendor',
          changes: { snapshot: { totalCost: 1200 } },
          createdAt: '2026-06-01T10:00:00Z',
        },
      ],
    });

    render(<RfqQuoteAuditTab rfqId="rfq-1" />);

    expect(screen.getByText('auditTab.action.SUBMITTED')).toBeInTheDocument();
    expect(screen.getByText('auditTab.source.PDF')).toBeInTheDocument();
    expect(screen.getByText('Jane Vendor')).toBeInTheDocument();
    expect(screen.getByText('VendorCo')).toBeInTheDocument();
  });
});
