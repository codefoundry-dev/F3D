import { render, screen } from '@testing-library/react';

vi.mock('@forethread/invoice-shared', () => ({
  InvoiceListPage: () => <div data-testid="invoice-list-page">InvoiceListPage</div>,
}));

import InvoiceListPage from './InvoiceListPage';

describe('BuyerInvoiceListPage', () => {
  it('renders the shared InvoiceListPage component', () => {
    render(<InvoiceListPage />);
    expect(screen.getByTestId('invoice-list-page')).toBeInTheDocument();
  });
});
