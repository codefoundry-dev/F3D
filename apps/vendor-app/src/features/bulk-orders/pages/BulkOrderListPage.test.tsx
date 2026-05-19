vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/bulk-order-shared', () => ({
  BulkOrderListPage: (props: Record<string, unknown>) => (
    <div
      data-testid="shared-bulk-order-list"
      data-counterparty-label={props.counterpartyFilterLabel}
      data-counterparty-popover={props.counterpartyPopoverTitle}
      data-counterparty-column={props.counterpartyColumnKey}
    />
  ),
}));

import { render, screen } from '@testing-library/react';

import BulkOrderListPage from './BulkOrderListPage';

describe('BulkOrderListPage', () => {
  it('renders the shared list page with contractor config', () => {
    render(<BulkOrderListPage />);
    const el = screen.getByTestId('shared-bulk-order-list');
    expect(el).toBeInTheDocument();
    expect(el).toHaveAttribute('data-counterparty-label', 'list.allContractors');
    expect(el).toHaveAttribute('data-counterparty-popover', 'filters.contractorsTitle');
    expect(el).toHaveAttribute('data-counterparty-column', 'contractorName');
  });
});
