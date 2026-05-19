vi.mock('@forethread/bulk-order-shared', () => ({
  DrawdownPage: () => <div data-testid="shared-drawdown" />,
}));

import { render, screen } from '@testing-library/react';

import BulkOrderDrawdownPage from './BulkOrderDrawdownPage';

describe('BulkOrderDrawdownPage', () => {
  it('renders the shared DrawdownPage', () => {
    render(<BulkOrderDrawdownPage />);
    expect(screen.getByTestId('shared-drawdown')).toBeInTheDocument();
  });
});
