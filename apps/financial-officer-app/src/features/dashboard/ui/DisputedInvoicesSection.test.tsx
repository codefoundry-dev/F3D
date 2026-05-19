import type { InvoicePendingItem } from '@forethread/api-client';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
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
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
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
      </div>
    );
  },
}));

import { DisputedInvoicesSection } from './DisputedInvoicesSection';

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
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
    status: 'disputed',
  },
];

describe('DisputedInvoicesSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders section title', () => {
    render(<DisputedInvoicesSection items={[]} />, { wrapper });
    expect(screen.getByText('finance.disputed.title')).toBeInTheDocument();
  });

  it('shows empty state when no items', () => {
    render(<DisputedInvoicesSection items={[]} />, { wrapper });
    expect(screen.getByText('finance.disputed.noInvoices')).toBeInTheDocument();
  });

  it('renders invoice cards with data', () => {
    render(<DisputedInvoicesSection items={mockItems} />, { wrapper });
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
  });

  it('shows loading skeletons when isLoading', () => {
    const { container } = render(<DisputedInvoicesSection items={[]} isLoading />, { wrapper });
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('navigates to invoice detail on card click', () => {
    render(<DisputedInvoicesSection items={mockItems} />, { wrapper });
    fireEvent.click(screen.getByTestId('card-click'));
    expect(mockNavigate).toHaveBeenCalledWith('/invoices/1');
  });

  it('navigates to messages tab on message click', () => {
    render(<DisputedInvoicesSection items={mockItems} />, { wrapper });
    fireEvent.click(screen.getByTestId('message-click'));
    expect(mockNavigate).toHaveBeenCalledWith('/invoices/1?tab=messages');
  });

  it('navigates to attachments tab on attachment click', () => {
    render(<DisputedInvoicesSection items={mockItems} />, { wrapper });
    fireEvent.click(screen.getByTestId('attachment-click'));
    expect(mockNavigate).toHaveBeenCalledWith('/invoices/1?tab=attachments');
  });
});
