import { render, screen } from '@testing-library/react';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/ui-components/assets/icons/clock-icon.svg?react', () => ({
  default: () => <span data-testid="clock-icon" />,
}));

vi.mock('@forethread/ui-components/assets/icons/users-group.svg?react', () => ({
  default: () => <span data-testid="users-icon" />,
}));

vi.mock('@forethread/ui-components/assets/icons/file-lock.svg?react', () => ({
  default: () => <span data-testid="file-lock-icon" />,
}));

vi.mock('@forethread/ui-components/assets/icons/trend-up.svg?react', () => ({
  default: () => <span data-testid="trend-up-icon" />,
}));

import { InvoiceKpiCards } from './InvoiceKpiCards';

const defaultProps = {
  totalPendingAmount: 50000,
  pendingInvoiceCount: 12,
  invoicesDueThisWeek: 5,
  invoicesDueAmount: 15000,
  disputedInvoiceCount: 3,
  disputedTrend: 0,
};

describe('InvoiceKpiCards', () => {
  it('renders all 3 KPI card labels', () => {
    render(<InvoiceKpiCards {...defaultProps} />);
    expect(screen.getByText('finance.totalPendingAmount')).toBeInTheDocument();
    expect(screen.getByText('finance.invoicesDueThisWeek')).toBeInTheDocument();
    expect(screen.getByText('finance.disputedInvoices')).toBeInTheDocument();
  });

  it('renders formatted amounts', () => {
    render(<InvoiceKpiCards {...defaultProps} />);
    expect(screen.getByText('$50,000.00')).toBeInTheDocument();
    expect(screen.getByText(/\$15,000\.00/)).toBeInTheDocument();
  });

  it('renders counts', () => {
    render(<InvoiceKpiCards {...defaultProps} />);
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('shows trend when disputedTrend is non-zero', () => {
    render(<InvoiceKpiCards {...defaultProps} disputedTrend={2} />);
    expect(screen.getByText(/\+2 this week/)).toBeInTheDocument();
  });

  it('does not show trend when disputedTrend is 0', () => {
    render(<InvoiceKpiCards {...defaultProps} disputedTrend={0} />);
    expect(screen.queryByText(/this week/)).not.toBeInTheDocument();
  });

  it('shows loading skeletons when isLoading', () => {
    const { container } = render(<InvoiceKpiCards {...defaultProps} isLoading />);
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBe(3);
  });
});
