import type { QuoteResponseItem } from '@forethread/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockApproveQuote = vi.hoisted(() => vi.fn());
const mockDeclineQuote = vi.hoisted(() => vi.fn());

vi.mock('@forethread/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@forethread/api-client')>();
  return {
    ...actual,
    approveQuote: mockApproveQuote,
    declineQuote: mockDeclineQuote,
  };
});

vi.mock('@forethread/ui-components/assets/icons/file-text.svg?react', () => ({
  default: () => <span data-testid="file-text-icon" />,
}));
vi.mock('@forethread/ui-components/assets/icons/briefcase.svg?react', () => ({
  default: () => <span data-testid="briefcase-icon" />,
}));
vi.mock('@forethread/ui-components/assets/icons/date.svg?react', () => ({
  default: () => <span data-testid="date-icon" />,
}));
vi.mock('@forethread/ui-components/assets/icons/coins.svg?react', () => ({
  default: () => <span data-testid="coins-icon" />,
}));
vi.mock('@forethread/ui-components/assets/icons/package.svg?react', () => ({
  default: () => <span data-testid="package-icon" />,
}));
vi.mock('@forethread/ui-components/assets/icons/checkcircle-icon.svg?react', () => ({
  default: () => <span data-testid="check-icon" />,
}));
vi.mock('@forethread/ui-components/assets/icons/cross-in-circle.svg?react', () => ({
  default: () => <span data-testid="cross-icon" />,
}));

import { QuoteResponsesSection } from './QuoteResponsesSection';

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

const mockItems: QuoteResponseItem[] = [
  {
    id: '1',
    vendorName: 'Acme Corp',
    vendorCountry: 'US',
    rfqId: 'RFQ-001',
    rfqNumber: 'RFQ-0000001',
    projectName: 'Project Alpha',
    dateRange: '2026-01-01 - 2026-02-01',
    totalCost: 5000,
    discountPercent: 10,
    discountAmount: 500,
    itemsCovered: 5,
    totalItems: 5,
    status: 'received',
  },
  {
    id: '2',
    vendorName: 'Beta Inc',
    vendorCountry: null,
    rfqId: 'RFQ-002',
    rfqNumber: 'RFQ-0000002',
    projectName: 'Project Beta',
    dateRange: null,
    totalCost: 3000,
    discountPercent: null,
    discountAmount: null,
    itemsCovered: 3,
    totalItems: 5,
    status: 'PENDING',
  },
];

describe('QuoteResponsesSection', () => {
  it('renders section title', () => {
    render(<QuoteResponsesSection items={[]} />, { wrapper });
    expect(screen.getByText('quoteResponses.title')).toBeInTheDocument();
  });

  it('shows empty state when no items', () => {
    render(<QuoteResponsesSection items={[]} />, { wrapper });
    expect(screen.getByText('quoteResponses.noResponses')).toBeInTheDocument();
  });

  it('renders all items by default on All tab', () => {
    render(<QuoteResponsesSection items={mockItems} />, { wrapper });
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('Beta Inc')).toBeInTheDocument();
  });

  it('switches to pending tab', () => {
    render(<QuoteResponsesSection items={mockItems} />, { wrapper });
    fireEvent.click(screen.getByText('quoteResponses.pending'));
    expect(screen.getByText('Beta Inc')).toBeInTheDocument();
    expect(screen.queryByText('Acme Corp')).not.toBeInTheDocument();
  });

  it('renders Decline and Approve buttons for pending items', () => {
    const pendingItems: QuoteResponseItem[] = [
      {
        id: '2',
        vendorName: 'Beta Inc',
        vendorCountry: null,
        rfqId: 'RFQ-002',
        rfqNumber: 'RFQ-0000002',
        projectName: 'Project Beta',
        dateRange: null,
        totalCost: 3000,
        discountPercent: null,
        discountAmount: null,
        itemsCovered: 3,
        totalItems: 5,
        status: 'PENDING',
      },
    ];
    render(<QuoteResponsesSection items={pendingItems} />, { wrapper });
    expect(screen.getByText('quoteResponses.decline')).toBeInTheDocument();
    expect(screen.getByText('quoteResponses.approve')).toBeInTheDocument();
  });

  it('shows loading skeletons when isLoading', () => {
    const { container } = render(<QuoteResponsesSection items={[]} isLoading />, { wrapper });
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('clicking approve button triggers approve mutation', async () => {
    const pendingItems: QuoteResponseItem[] = [mockItems[1]]; // status: 'PENDING'
    mockApproveQuote.mockResolvedValue(undefined);
    render(<QuoteResponsesSection items={pendingItems} />, { wrapper });
    fireEvent.click(screen.getByText('quoteResponses.approve'));
    await vi.waitFor(() => {
      expect(mockApproveQuote).toHaveBeenCalledWith('RFQ-002', '2');
    });
  });

  it('clicking decline button triggers decline mutation', async () => {
    const pendingItems: QuoteResponseItem[] = [mockItems[1]]; // status: 'PENDING'
    mockDeclineQuote.mockResolvedValue(undefined);
    render(<QuoteResponsesSection items={pendingItems} />, { wrapper });
    fireEvent.click(screen.getByText('quoteResponses.decline'));
    await vi.waitFor(() => {
      expect(mockDeclineQuote).toHaveBeenCalledWith('RFQ-002', '2');
    });
  });

  it('does not render approve/decline for non-pending items', () => {
    const receivedItems: QuoteResponseItem[] = [mockItems[0]]; // status: 'received'
    render(<QuoteResponsesSection items={receivedItems} />, { wrapper });
    expect(screen.queryByText('quoteResponses.approve')).not.toBeInTheDocument();
    expect(screen.queryByText('quoteResponses.decline')).not.toBeInTheDocument();
  });

  it('switching to acknowledged tab shows empty', () => {
    render(<QuoteResponsesSection items={mockItems} />, { wrapper });
    fireEvent.click(screen.getByText('quoteResponses.acknowledged'));
    expect(screen.getByText('quoteResponses.noResponses')).toBeInTheDocument();
  });

  it('switching back to all tab shows all items', () => {
    render(<QuoteResponsesSection items={mockItems} />, { wrapper });
    fireEvent.click(screen.getByText('quoteResponses.pending'));
    fireEvent.click(screen.getByText('quoteResponses.all'));
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('Beta Inc')).toBeInTheDocument();
  });
});
