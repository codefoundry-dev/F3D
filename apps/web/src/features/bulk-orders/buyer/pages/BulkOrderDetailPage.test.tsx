vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/bulk-order-shared', () => ({
  BulkOrderDetailPage: ({ counterpartyLabel }: { counterpartyLabel?: string }) => (
    <div data-testid="shared-detail" data-counterparty-label={counterpartyLabel} />
  ),
}));

import { render, screen } from '@testing-library/react';

import BulkOrderDetailPage from './BulkOrderDetailPage';

describe('BulkOrderDetailPage', () => {
  it('renders the shared detail page with vendor label', () => {
    render(<BulkOrderDetailPage />);
    const el = screen.getByTestId('shared-detail');
    expect(el).toBeInTheDocument();
    expect(el).toHaveAttribute('data-counterparty-label', 'detail.vendorName');
  });
});
