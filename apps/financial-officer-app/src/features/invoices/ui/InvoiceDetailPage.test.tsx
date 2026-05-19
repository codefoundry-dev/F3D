import { render, screen } from '@testing-library/react';

vi.mock('@forethread/invoice-shared', () => ({
  InvoiceDetailPage: ({ canApprove }: { canApprove: boolean }) => (
    <div data-testid="invoice-detail" data-can-approve={canApprove}>
      Invoice Detail
    </div>
  ),
}));

import FOInvoiceDetailPage from './InvoiceDetailPage';

describe('FOInvoiceDetailPage', () => {
  it('renders InvoiceDetailPage with canApprove prop', () => {
    render(<FOInvoiceDetailPage />);
    const el = screen.getByTestId('invoice-detail');
    expect(el).toBeInTheDocument();
    expect(el.getAttribute('data-can-approve')).toBe('true');
  });
});
