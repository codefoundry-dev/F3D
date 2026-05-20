vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/bulk-order-shared', () => ({
  BulkOrderDetailPage: ({
    counterpartyLabel,
    showDrawdown,
    showChangeActions,
  }: {
    counterpartyLabel?: string;
    showDrawdown?: boolean;
    showChangeActions?: boolean;
  }) => (
    <div
      data-testid="shared-detail"
      data-counterparty-label={counterpartyLabel}
      data-show-drawdown={String(showDrawdown)}
      data-show-change-actions={String(showChangeActions)}
    />
  ),
}));

import { render, screen } from '@testing-library/react';

import BulkOrderDetailPage from './BulkOrderDetailPage';

describe('BulkOrderDetailPage', () => {
  it('renders the shared detail page with contractor label', () => {
    render(<BulkOrderDetailPage />);
    const el = screen.getByTestId('shared-detail');
    expect(el).toBeInTheDocument();
    expect(el).toHaveAttribute('data-counterparty-label', 'detail.contractor');
  });

  it('hides drawdown for vendor', () => {
    render(<BulkOrderDetailPage />);
    const el = screen.getByTestId('shared-detail');
    expect(el).toHaveAttribute('data-show-drawdown', 'false');
  });

  it('shows change actions for vendor', () => {
    render(<BulkOrderDetailPage />);
    const el = screen.getByTestId('shared-detail');
    expect(el).toHaveAttribute('data-show-change-actions', 'true');
  });
});
