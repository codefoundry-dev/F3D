vi.mock('@forethread/bulk-order-shared', () => ({
  EditBulkOrderPage: () => <div data-testid="shared-edit" />,
}));

import { render, screen } from '@testing-library/react';

import BulkOrderEditPage from './BulkOrderEditPage';

describe('BulkOrderEditPage', () => {
  it('renders the shared EditBulkOrderPage', () => {
    render(<BulkOrderEditPage />);
    expect(screen.getByTestId('shared-edit')).toBeInTheDocument();
  });
});
