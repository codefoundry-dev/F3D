vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@forethread/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@forethread/api-client')>();
  return { ...actual, approveInvoice: vi.fn(), rejectInvoice: vi.fn() };
});

vi.mock('@forethread/ui-components', () => ({
  DashboardSection: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div data-testid="section">
      <h2>{title}</h2>
      {children}
    </div>
  ),
  DashboardSectionSkeleton: ({ title }: { title: string }) => (
    <div data-testid="skeleton">{title}</div>
  ),
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
  InvoiceCard: ({
    name,
    actions,
    onCardClick,
  }: {
    name: string;
    actions: React.ReactNode;
    onCardClick?: () => void;
  }) => (
    <div
      data-testid="invoice-card"
      role="button"
      tabIndex={0}
      onClick={onCardClick}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === 'Enter') onCardClick?.();
      }}
    >
      <span>{name}</span>
      {actions}
    </div>
  ),
}));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';

import { InvoicesPendingApproval } from './InvoicesPendingApproval';

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('InvoicesPendingApproval', () => {
  it('shows skeleton when loading', () => {
    render(<InvoicesPendingApproval items={[]} isLoading />, { wrapper });
    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  });

  it('shows empty message', () => {
    render(<InvoicesPendingApproval items={[]} />, { wrapper });
    expect(screen.getByText('invoicesPendingApproval.noInvoices')).toBeInTheDocument();
  });

  it('renders cards with items', () => {
    const items = [
      { id: '1', vendorName: 'Vendor A', amount: 1000, dueDate: '2025-01-01', status: 'PENDING' },
    ] as never[];
    render(<InvoicesPendingApproval items={items} />, { wrapper });
    expect(screen.getByText('Vendor A')).toBeInTheDocument();
    expect(screen.getByText('invoicesPendingApproval.approve')).toBeInTheDocument();
    expect(screen.getByText('invoicesPendingApproval.reject')).toBeInTheDocument();
  });

  it('calls approve mutation when approve is clicked', () => {
    const items = [
      { id: '1', vendorName: 'Vendor A', amount: 1000, dueDate: '2025-01-01', status: 'PENDING' },
    ] as never[];
    render(<InvoicesPendingApproval items={items} />, { wrapper });
    fireEvent.click(screen.getByText('invoicesPendingApproval.approve'));
  });

  it('calls reject mutation when reject is clicked', () => {
    const items = [
      { id: '1', vendorName: 'Vendor A', amount: 1000, dueDate: '2025-01-01', status: 'PENDING' },
    ] as never[];
    render(<InvoicesPendingApproval items={items} />, { wrapper });
    fireEvent.click(screen.getByText('invoicesPendingApproval.reject'));
  });

  it('navigates on card click', () => {
    const items = [
      { id: '1', vendorName: 'Vendor A', amount: 1000, dueDate: '2025-01-01', status: 'PENDING' },
    ] as never[];
    render(<InvoicesPendingApproval items={items} />, { wrapper });
    fireEvent.click(screen.getByTestId('invoice-card'));
  });
});
