import { render, screen } from '@testing-library/react';

vi.mock('@forethread/invoice-shared', () => ({
  InvoiceDetailPage: ({ canApprove, canReview }: { canApprove: boolean; canReview: boolean }) => (
    <div data-testid="invoice-detail" data-can-approve={canApprove} data-can-review={canReview}>
      Invoice Detail
    </div>
  ),
}));

import FinanceInvoiceDetailPage from './InvoiceDetailPage';

describe('FinanceInvoiceDetailPage', () => {
  it('renders InvoiceDetailPage with canApprove and canReview props', () => {
    render(<FinanceInvoiceDetailPage />);
    const el = screen.getByTestId('invoice-detail');
    expect(el).toBeInTheDocument();
    expect(el.getAttribute('data-can-approve')).toBe('true');
    expect(el.getAttribute('data-can-review')).toBe('true');
  });
});
