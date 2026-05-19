vi.mock('@forethread/bulk-order-shared', () => ({
  BulkOrderListPage: (props: Record<string, unknown>) => (
    <div data-testid="shared-bulk-order-list" data-props={JSON.stringify(props)} />
  ),
}));

vi.mock('../../purchase-orders/services/purchase-orders.service', () => ({
  useCompanyVendors: () => ({ data: [] }),
}));

import { render, screen } from '@testing-library/react';

import BulkOrderListPage from './BulkOrderListPage';

describe('BulkOrderListPage', () => {
  it('renders the shared BulkOrderListPage with default props', () => {
    render(<BulkOrderListPage />);
    expect(screen.getByTestId('shared-bulk-order-list')).toBeInTheDocument();
  });
});
