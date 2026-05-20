vi.mock('@forethread/bulk-order-shared', () => ({
  EditBulkOrderPage: () => <div data-testid="edit-bulk-order-page" />,
}));

import { render, screen } from '@testing-library/react';

import BulkOrderEditPage from './BulkOrderEditPage';

describe('BulkOrderEditPage', () => {
  it('renders EditBulkOrderPage', () => {
    render(<BulkOrderEditPage />);
    expect(screen.getByTestId('edit-bulk-order-page')).toBeInTheDocument();
  });
});
