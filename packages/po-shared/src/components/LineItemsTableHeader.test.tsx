vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { render, screen } from '@testing-library/react';

import { LineItemsTableHeader } from './LineItemsTableHeader';

function renderHeader(isDrawdownMode?: boolean) {
  return render(
    <table>
      <LineItemsTableHeader isDrawdownMode={isDrawdownMode} />
    </table>,
  );
}

describe('LineItemsTableHeader', () => {
  it('renders the validation columns (Appr. RFQ + Bulk orders) by default', () => {
    renderHeader(false);
    expect(screen.getByText('create.approvedRfq')).toBeInTheDocument();
    expect(screen.getByText('create.bulkOrders')).toBeInTheDocument();
    expect(screen.queryByText('create.availableQty')).not.toBeInTheDocument();
  });

  it('replaces the validation columns with "Available qty" in drawdown mode', () => {
    renderHeader(true);
    expect(screen.getByText('create.availableQty')).toBeInTheDocument();
    expect(screen.queryByText('create.approvedRfq')).not.toBeInTheDocument();
    expect(screen.queryByText('create.bulkOrders')).not.toBeInTheDocument();
  });

  it('always renders the core columns', () => {
    renderHeader(true);
    expect(screen.getByText('create.materialName')).toBeInTheDocument();
    expect(screen.getByText('create.qtyOrdered')).toBeInTheDocument();
    expect(screen.getByText('create.actionsCol')).toBeInTheDocument();
  });
});
