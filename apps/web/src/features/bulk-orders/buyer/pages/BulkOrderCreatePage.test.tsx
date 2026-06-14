vi.mock('@forethread/bulk-order-shared', () => ({
  CreateBulkOrderPage: () => <div data-testid="shared-create-bulk-order" />,
}));

import { render, screen } from '@testing-library/react';

import BulkOrderCreatePage from './BulkOrderCreatePage';

describe('BulkOrderCreatePage', () => {
  it('renders the shared create bulk order page', () => {
    render(<BulkOrderCreatePage />);
    expect(screen.getByTestId('shared-create-bulk-order')).toBeInTheDocument();
  });
});
