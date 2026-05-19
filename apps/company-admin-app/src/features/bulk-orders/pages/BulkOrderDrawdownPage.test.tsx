vi.mock('@forethread/bulk-order-shared', () => ({
  DrawdownPage: () => <div data-testid="drawdown-page" />,
}));

import { render, screen } from '@testing-library/react';

import BulkOrderDrawdownPage from './BulkOrderDrawdownPage';

describe('BulkOrderDrawdownPage', () => {
  it('renders DrawdownPage', () => {
    render(<BulkOrderDrawdownPage />);
    expect(screen.getByTestId('drawdown-page')).toBeInTheDocument();
  });
});
