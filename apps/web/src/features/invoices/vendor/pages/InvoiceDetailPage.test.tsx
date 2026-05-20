import { render, screen } from '@testing-library/react';

vi.mock('@forethread/invoice-shared', () => ({
  InvoiceDetailPage: () => <div data-testid="invoice-detail">Invoice Detail</div>,
}));

import VendorInvoiceDetailPage from './InvoiceDetailPage';

describe('VendorInvoiceDetailPage', () => {
  it('renders InvoiceDetailPage from shared package', () => {
    render(<VendorInvoiceDetailPage />);
    const el = screen.getByTestId('invoice-detail');
    expect(el).toBeInTheDocument();
  });
});
