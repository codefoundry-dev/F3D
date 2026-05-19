vi.mock('@forethread/bulk-order-shared', () => ({
  ProposeChangePage: () => <div data-testid="propose-change-page" />,
}));

import { render, screen } from '@testing-library/react';

import BulkOrderChangePage from './BulkOrderChangePage';

describe('BulkOrderChangePage', () => {
  it('renders ProposeChangePage', () => {
    render(<BulkOrderChangePage />);
    expect(screen.getByTestId('propose-change-page')).toBeInTheDocument();
  });
});
