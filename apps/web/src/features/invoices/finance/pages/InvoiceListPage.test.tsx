import { render, screen } from '@testing-library/react';

vi.mock('@forethread/invoice-shared', () => ({
  InvoiceListPage: ({ extraInvalidateKeys }: { extraInvalidateKeys: string[][] }) => (
    <div data-testid="invoice-list" data-keys={JSON.stringify(extraInvalidateKeys)}>
      Invoice List
    </div>
  ),
}));

import FinanceInvoiceListPage from './InvoiceListPage';

describe('FinanceInvoiceListPage', () => {
  it('renders InvoiceListPage with extra invalidate keys', () => {
    render(<FinanceInvoiceListPage />);
    const el = screen.getByTestId('invoice-list');
    expect(el).toBeInTheDocument();
    expect(JSON.parse(el.getAttribute('data-keys')!)).toEqual([['dashboard', 'finance']]);
  });
});
