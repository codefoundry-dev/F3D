import type { VendorInvoiceItem } from '@forethread/api-client';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

import { InvoicesSection } from './InvoicesSection';

const mockItems: VendorInvoiceItem[] = [
  {
    id: '1',
    companyName: 'BuildCo',
    status: 'approved',
    companyCountry: 'US',
    invoiceId: 'INV-200',
    projectName: 'Tower Project',
    poReference: 'PO-050',
    date: '2026-02-01',
    totalCost: 12000,
    itemCount: 4,
  },
];

describe('InvoicesSection', () => {
  it('renders section title', () => {
    render(
      <MemoryRouter>
        <InvoicesSection items={[]} />
      </MemoryRouter>,
    );
    expect(screen.getByText('vendor.invoices.title')).toBeInTheDocument();
  });

  it('shows empty state when no items', () => {
    render(
      <MemoryRouter>
        <InvoicesSection items={[]} />
      </MemoryRouter>,
    );
    expect(screen.getByText('vendor.invoices.noInvoices')).toBeInTheDocument();
  });

  it('renders invoice cards with data', () => {
    render(
      <MemoryRouter>
        <InvoicesSection items={mockItems} />
      </MemoryRouter>,
    );
    expect(screen.getByText('BuildCo')).toBeInTheDocument();
    expect(screen.getByText('INV-200')).toBeInTheDocument();
    expect(screen.getByText('Approved')).toBeInTheDocument();
  });

  it('shows loading skeletons when isLoading', () => {
    const { container } = render(
      <MemoryRouter>
        <InvoicesSection items={[]} isLoading />
      </MemoryRouter>,
    );
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('clicking invoice card navigates to invoice detail', () => {
    render(
      <MemoryRouter>
        <InvoicesSection items={mockItems} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText('BuildCo'));
    expect(mockNavigate).toHaveBeenCalledWith('/invoices/1');
  });
});
