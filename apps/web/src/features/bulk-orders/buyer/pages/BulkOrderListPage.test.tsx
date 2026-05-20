vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/bulk-order-shared', () => ({
  BulkOrderListPage: (props: Record<string, unknown>) => (
    <div data-testid="shared-bulk-order-list" data-counterparty-type={props.counterpartyType} />
  ),
}));

vi.mock('@/features/purchase-orders/buyer/services/purchase-orders.service', () => ({
  useCompanyVendors: () => ({ data: [] }),
}));

import { render, screen } from '@testing-library/react';

import BulkOrderListPage from './BulkOrderListPage';

describe('BulkOrderListPage', () => {
  it('renders the shared list page with vendor counterparty type', () => {
    render(<BulkOrderListPage />);
    const el = screen.getByTestId('shared-bulk-order-list');
    expect(el).toBeInTheDocument();
    expect(el).toHaveAttribute('data-counterparty-type', 'vendor');
  });
});
