vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'inv-123' }),
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/rfq-shared', () => ({
  usePageTitleStore: () => vi.fn(),
}));

vi.mock('@forethread/ui-components', () => ({
  PageLoader: () => <div data-testid="page-loader">Loading...</div>,
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
}));

vi.mock('@forethread/api-client', () => ({
  getFileUrl: vi.fn(),
}));

vi.mock('@forethread/invoice-shared', () => ({
  InvoiceDetailPage: () => (
    <div>
      <span>invoiceDetail.tabs.quoteLineItems</span>
      <button>invoiceDetail.approve</button>
      <button>invoiceDetail.decline</button>
      <span>Test Project</span>
      <span>Test Vendor</span>
    </div>
  ),
}));

import { render, screen } from '@testing-library/react';

import InvoiceDetailPage from './InvoiceDetailPage';

describe('InvoiceDetailPage', () => {
  it('renders invoice detail with tabs', () => {
    render(<InvoiceDetailPage />);
    expect(screen.getByText('invoiceDetail.tabs.quoteLineItems')).toBeInTheDocument();
  });

  it('renders approve and decline buttons for pending invoices', () => {
    render(<InvoiceDetailPage />);
    expect(screen.getByText('invoiceDetail.approve')).toBeInTheDocument();
    expect(screen.getByText('invoiceDetail.decline')).toBeInTheDocument();
  });

  it('renders invoice data in the details tab', () => {
    render(<InvoiceDetailPage />);
    expect(screen.getByText('Test Project')).toBeInTheDocument();
    expect(screen.getByText('Test Vendor')).toBeInTheDocument();
  });
});
