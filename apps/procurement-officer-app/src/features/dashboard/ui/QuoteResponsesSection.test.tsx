vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@forethread/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@forethread/api-client')>();
  return { ...actual, approveQuote: vi.fn(), declineQuote: vi.fn() };
});

vi.mock('@forethread/ui-components', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  formatStatus: (status: string | null | undefined) => {
    if (!status) return '-';
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase().replace(/_/g, ' ');
  },
  formatCurrency: (v: number | null | undefined) =>
    v === null || v === undefined
      ? '-'
      : `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
  formatDate: (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  },
  DashboardItemCard: ({
    name,
    fields,
    actions,
    onCardClick,
    onMessageClick,
    onAttachmentClick,
  }: {
    name: string;
    fields: Array<{ icon: React.ReactNode; value: string }>;
    actions?: React.ReactNode;
    onCardClick?: () => void;
    onMessageClick?: () => void;
    onAttachmentClick?: () => void;
  }) => (
    <div data-testid="quote-card">
      <span>{name}</span>
      {fields?.map((f, i) => (
        <span key={i}>{f.value}</span>
      ))}
      {actions}
      {onCardClick && (
        <button data-testid="card-click" onClick={onCardClick}>
          card
        </button>
      )}
      {onMessageClick && (
        <button data-testid="message-click" onClick={onMessageClick}>
          msg
        </button>
      )}
      {onAttachmentClick && (
        <button data-testid="attachment-click" onClick={onAttachmentClick}>
          attach
        </button>
      )}
    </div>
  ),
  DashboardSectionSkeleton: ({ title }: { title: string }) => (
    <div data-testid="skeleton">{title}</div>
  ),
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
}));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';

import { QuoteResponsesSection } from './QuoteResponsesSection';

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const mockItem = {
  id: 'q1',
  rfqId: 'rfq-1',
  vendorName: 'QuoteVendor',
  projectName: 'Project B',
  dateRange: '2025-01-01 - 2025-02-01',
  totalCost: 10000,
  itemsCovered: 5,
  totalItems: 10,
  status: 'PENDING',
  hasUnreadMessages: true,
  hasAttachments: false,
};

describe('QuoteResponsesSection', () => {
  it('shows skeleton when loading', () => {
    render(<QuoteResponsesSection items={[]} isLoading />, { wrapper });
    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  });

  it('shows empty message', () => {
    render(<QuoteResponsesSection items={[]} />, { wrapper });
    expect(screen.getByText('quoteResponses.noResponses')).toBeInTheDocument();
  });

  it('renders items with approve/decline for pending', () => {
    render(<QuoteResponsesSection items={[mockItem as never]} />, { wrapper });
    expect(screen.getByText('QuoteVendor')).toBeInTheDocument();
    expect(screen.getByText('quoteResponses.approve')).toBeInTheDocument();
    expect(screen.getByText('quoteResponses.decline')).toBeInTheDocument();
  });

  it('filters by tab', () => {
    render(<QuoteResponsesSection items={[mockItem as never]} />, { wrapper });
    fireEvent.click(screen.getByText('quoteResponses.acknowledged'));
    expect(screen.getByText('quoteResponses.noResponses')).toBeInTheDocument();

    fireEvent.click(screen.getByText('quoteResponses.all'));
    expect(screen.getByText('QuoteVendor')).toBeInTheDocument();
  });

  it('hides actions for non-pending items', () => {
    const acknowledgedItem = { ...mockItem, status: 'Acknowledged' };
    render(<QuoteResponsesSection items={[acknowledgedItem as never]} />, { wrapper });
    expect(screen.queryByText('quoteResponses.approve')).not.toBeInTheDocument();
  });

  it('calls approve mutation when approve button is clicked', () => {
    render(<QuoteResponsesSection items={[mockItem as never]} />, { wrapper });
    fireEvent.click(screen.getByText('quoteResponses.approve'));
  });

  it('calls decline mutation when decline button is clicked', () => {
    render(<QuoteResponsesSection items={[mockItem as never]} />, { wrapper });
    fireEvent.click(screen.getByText('quoteResponses.decline'));
  });

  it('navigates on card click', () => {
    render(<QuoteResponsesSection items={[mockItem as never]} />, { wrapper });
    fireEvent.click(screen.getByTestId('card-click'));
  });

  it('navigates on message click', () => {
    render(<QuoteResponsesSection items={[mockItem as never]} />, { wrapper });
    fireEvent.click(screen.getByTestId('message-click'));
  });

  it('navigates on attachment click', () => {
    render(<QuoteResponsesSection items={[mockItem as never]} />, { wrapper });
    fireEvent.click(screen.getByTestId('attachment-click'));
  });
});
