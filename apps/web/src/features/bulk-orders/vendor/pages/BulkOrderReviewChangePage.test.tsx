vi.mock('@forethread/bulk-order-shared', () => ({
  ReviewChangesPage: () => <div data-testid="review-changes-page" />,
}));

import { render, screen } from '@testing-library/react';

import BulkOrderReviewChangePage from './BulkOrderReviewChangePage';

describe('BulkOrderReviewChangePage', () => {
  it('renders ReviewChangesPage', () => {
    render(<BulkOrderReviewChangePage />);
    expect(screen.getByTestId('review-changes-page')).toBeInTheDocument();
  });
});
