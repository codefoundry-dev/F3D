vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { render, screen } from '@testing-library/react';

import { KpiSummaryCards } from './KpiSummaryCards';

describe('KpiSummaryCards', () => {
  it('shows skeleton when loading', () => {
    const { container } = render(<KpiSummaryCards data={null} isLoading />);
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(4);
  });

  it('renders cards with data', () => {
    const data = {
      rfqs: { pending: 5, overdue: 2 },
      pos: { pending: 3, overdue: 0 },
      quotes: { pending: 1, overdue: 1 },
      invoices: { pending: 4, overdue: 3 },
    };
    render(<KpiSummaryCards data={data} />);
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getAllByText('3')).toHaveLength(2);
  });

  it('renders zero counts when data is null', () => {
    render(<KpiSummaryCards data={null} />);
    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBeGreaterThan(0);
  });
});
