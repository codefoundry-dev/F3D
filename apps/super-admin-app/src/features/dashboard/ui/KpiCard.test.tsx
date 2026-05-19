import { render, screen } from '@testing-library/react';

vi.mock('@forethread/ui-components/assets/icons/trend-up.svg?react', () => ({
  default: () => <span data-testid="trend-up-icon" />,
}));
vi.mock('@forethread/ui-components/assets/icons/arrow-down.svg?react', () => ({
  default: () => <span data-testid="arrow-down-icon" />,
}));

import { KpiCard } from './KpiCard';

describe('KpiCard', () => {
  it('renders title and value', () => {
    render(<KpiCard icon={<span>icon</span>} title="Active Users" value="42" />);

    expect(screen.getByText('Active Users')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders the icon', () => {
    render(<KpiCard icon={<span data-testid="test-icon">icon</span>} title="Title" value="10" />);

    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });

  it('applies custom valueClassName', () => {
    render(
      <KpiCard
        icon={<span>icon</span>}
        title="Title"
        value="100"
        valueClassName="text-2xl font-bold"
      />,
    );

    const valueEl = screen.getByText('100');
    expect(valueEl).toHaveClass('text-2xl', 'font-bold');
  });

  it('renders trend up indicator when trendUp is true', () => {
    render(
      <KpiCard icon={<span>icon</span>} title="Title" value="50" trend="+5 this week" trendUp />,
    );

    expect(screen.getByText('+5 this week')).toBeInTheDocument();
    expect(screen.getByTestId('trend-up-icon')).toBeInTheDocument();
  });

  it('renders trend down indicator when trendUp is false', () => {
    render(
      <KpiCard
        icon={<span>icon</span>}
        title="Title"
        value="50"
        trend="-3 this week"
        trendUp={false}
      />,
    );

    expect(screen.getByText('-3 this week')).toBeInTheDocument();
    expect(screen.getByTestId('arrow-down-icon')).toBeInTheDocument();
  });

  it('does not render trend section when trend prop is undefined', () => {
    render(<KpiCard icon={<span>icon</span>} title="Title" value="50" />);

    expect(screen.queryByTestId('trend-up-icon')).not.toBeInTheDocument();
    expect(screen.queryByTestId('arrow-down-icon')).not.toBeInTheDocument();
  });

  it('renders statusIcon when provided', () => {
    render(
      <KpiCard
        icon={<span>icon</span>}
        title="Status"
        value="Healthy"
        statusIcon={<span data-testid="status-icon">check</span>}
      />,
    );

    expect(screen.getByTestId('status-icon')).toBeInTheDocument();
  });

  it('does not render statusIcon when not provided', () => {
    render(<KpiCard icon={<span>icon</span>} title="Status" value="Healthy" />);

    expect(screen.queryByTestId('status-icon')).not.toBeInTheDocument();
  });
});
