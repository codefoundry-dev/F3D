import type { InvoicePendingItem } from '@forethread/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

const mockApproveInvoice = vi.hoisted(() => vi.fn());
const mockRejectInvoice = vi.hoisted(() => vi.fn());

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@forethread/api-client')>();
  return {
    ...actual,
    approveInvoice: mockApproveInvoice,
    rejectInvoice: mockRejectInvoice,
  };
});

vi.mock('@forethread/ui-components/assets/icons/file-text.svg?react', () => ({
  default: () => <span data-testid="file-text-icon" />,
}));
vi.mock('@forethread/ui-components/assets/icons/flag.svg?react', () => ({
  default: () => <span data-testid="flag-icon" />,
}));
vi.mock('@forethread/ui-components/assets/icons/paperclip.svg?react', () => ({
  default: () => <span data-testid="paperclip-icon" />,
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
vi.mock('@forethread/ui-components/assets/icons/projects.svg?react', () => ({
  default: () => <span data-testid="projects-icon" />,
}));
vi.mock('@forethread/ui-components/assets/icons/briefcase.svg?react', () => ({
  default: () => <span data-testid="briefcase-icon" />,
}));
vi.mock('@forethread/ui-components/assets/icons/cart.svg?react', () => ({
  default: () => <span data-testid="cart-icon" />,
}));
vi.mock('@forethread/ui-components/assets/icons/checkcircle-icon.svg?react', () => ({
  default: () => <span data-testid="check-icon" />,
}));
vi.mock('@forethread/ui-components/assets/icons/cross-in-circle.svg?react', () => ({
  default: () => <span data-testid="cross-icon" />,
}));

import { InvoicesPendingApproval } from './InvoicesPendingApproval';

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
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

describe('InvoicesPendingApproval', () => {
  it('renders section title', () => {
    render(<InvoicesPendingApproval items={[]} />, { wrapper });
    expect(screen.getByText('invoicesPendingApproval.title')).toBeInTheDocument();
  });

  it('shows empty state when no items', () => {
    render(<InvoicesPendingApproval items={[]} />, { wrapper });
    expect(screen.getByText('invoicesPendingApproval.noInvoices')).toBeInTheDocument();
  });

  it('renders invoice cards with data', () => {
    render(<InvoicesPendingApproval items={mockItems} />, { wrapper });
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('INV-001')).toBeInTheDocument();
    expect(screen.getByText('PO-001')).toBeInTheDocument();
  });

  it('renders vendor name and invoice details', () => {
    render(<InvoicesPendingApproval items={mockItems} />, { wrapper });
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('Jan 15, 2026')).toBeInTheDocument();
  });

  it('shows loading skeletons when isLoading', () => {
    const { container } = render(<InvoicesPendingApproval items={[]} isLoading />, { wrapper });
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders approve and reject buttons', () => {
    render(<InvoicesPendingApproval items={mockItems} />, { wrapper });
    expect(screen.getByText('invoicesPendingApproval.approve')).toBeInTheDocument();
    expect(screen.getByText('invoicesPendingApproval.reject')).toBeInTheDocument();
  });

  it('clicking approve button triggers approve mutation', async () => {
    mockApproveInvoice.mockResolvedValue(undefined);
    render(<InvoicesPendingApproval items={mockItems} />, { wrapper });
    fireEvent.click(screen.getByText('invoicesPendingApproval.approve'));
    await vi.waitFor(() => {
      expect(mockApproveInvoice).toHaveBeenCalledWith('1');
    });
  });

  it('clicking reject button triggers reject mutation', async () => {
    mockRejectInvoice.mockResolvedValue(undefined);
    render(<InvoicesPendingApproval items={mockItems} />, { wrapper });
    fireEvent.click(screen.getByText('invoicesPendingApproval.reject'));
    await vi.waitFor(() => {
      expect(mockRejectInvoice).toHaveBeenCalledWith('1');
    });
  });
});
