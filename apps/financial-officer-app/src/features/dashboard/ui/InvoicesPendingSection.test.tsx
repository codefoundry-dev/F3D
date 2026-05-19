import type { InvoicePendingItem } from '@forethread/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();
const mockApproveInvoice = vi.hoisted(() => vi.fn());
const mockRejectInvoice = vi.hoisted(() => vi.fn());

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@forethread/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@forethread/api-client')>();
  return { ...actual, approveInvoice: mockApproveInvoice, rejectInvoice: mockRejectInvoice };
});

vi.mock('@forethread/ui-components', () => ({
  DashboardSection: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <div data-testid="section">
      <span>{title}</span>
      {children}
    </div>
  ),
  DashboardSectionSkeleton: ({ title }: { title: string }) => (
    <div className="animate-pulse">{title}</div>
  ),
  InvoiceCard: (props: Record<string, unknown>) => {
    const onCardClick = props.onCardClick as (() => void) | undefined;
    const onMessageClick = props.onMessageClick as (() => void) | undefined;
    const onAttachmentClick = props.onAttachmentClick as (() => void) | undefined;
    return (
      <div data-testid="invoice-card">
        <span>{props.name as string}</span>
        {onCardClick && (
          <button data-testid="card-click" onClick={onCardClick}>
            Card
          </button>
        )}
        {onMessageClick && (
          <button data-testid="message-click" onClick={onMessageClick}>
            Message
          </button>
        )}
        {onAttachmentClick && (
          <button data-testid="attachment-click" onClick={onAttachmentClick}>
            Attachment
          </button>
        )}
        {props.actions as React.ReactNode}
      </div>
    );
  },
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
}));

vi.mock('@forethread/ui-components/assets/icons/checkcircle-icon.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/cross-in-circle.svg?react', () => ({
  default: () => <span />,
}));

import { InvoicesPendingSection } from './InvoicesPendingSection';

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
}

const mockItems: InvoicePendingItem[] = [
  {
    id: '1',
    vendorName: 'Acme Corp',
    vendorCountry: 'US',
    invoiceId: 'INV-001',
    projectName: 'Project Alpha',
    poReference: 'PO-001',
    date: '2026-01-15',
    totalCost: 5000,
    itemCount: 3,
    status: 'pending',
  },
];

describe('InvoicesPendingSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApproveInvoice.mockResolvedValue({});
    mockRejectInvoice.mockResolvedValue({});
  });

  it('renders section title', () => {
    render(<InvoicesPendingSection items={[]} />, { wrapper });
    expect(screen.getByText('finance.invoicesPending.title')).toBeInTheDocument();
  });

  it('shows empty state when no items', () => {
    render(<InvoicesPendingSection items={[]} />, { wrapper });
    expect(screen.getByText('finance.invoicesPending.noInvoices')).toBeInTheDocument();
  });

  it('renders invoice cards with data', () => {
    render(<InvoicesPendingSection items={mockItems} />, { wrapper });
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
  });

  it('renders Reject and Approve buttons', () => {
    render(<InvoicesPendingSection items={mockItems} />, { wrapper });
    expect(screen.getByText('invoicesPendingApproval.reject')).toBeInTheDocument();
    expect(screen.getByText('invoicesPendingApproval.approve')).toBeInTheDocument();
  });

  it('shows loading skeletons when isLoading', () => {
    const { container } = render(<InvoicesPendingSection items={[]} isLoading />, { wrapper });
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('navigates to invoice detail on card click', () => {
    render(<InvoicesPendingSection items={mockItems} />, { wrapper });
    fireEvent.click(screen.getByTestId('card-click'));
    expect(mockNavigate).toHaveBeenCalledWith('/invoices/1');
  });

  it('navigates to messages tab on message click', () => {
    render(<InvoicesPendingSection items={mockItems} />, { wrapper });
    fireEvent.click(screen.getByTestId('message-click'));
    expect(mockNavigate).toHaveBeenCalledWith('/invoices/1?tab=messages');
  });

  it('navigates to attachments tab on attachment click', () => {
    render(<InvoicesPendingSection items={mockItems} />, { wrapper });
    fireEvent.click(screen.getByTestId('attachment-click'));
    expect(mockNavigate).toHaveBeenCalledWith('/invoices/1?tab=attachments');
  });

  it('calls approve mutation on approve click', async () => {
    render(<InvoicesPendingSection items={mockItems} />, { wrapper });
    fireEvent.click(screen.getByText('invoicesPendingApproval.approve'));
    await vi.waitFor(() => {
      expect(mockApproveInvoice).toHaveBeenCalled();
    });
  });

  it('calls reject mutation on reject click', async () => {
    render(<InvoicesPendingSection items={mockItems} />, { wrapper });
    fireEvent.click(screen.getByText('invoicesPendingApproval.reject'));
    await vi.waitFor(() => {
      expect(mockRejectInvoice).toHaveBeenCalled();
    });
  });
});
