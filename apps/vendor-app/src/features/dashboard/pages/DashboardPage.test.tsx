import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockDashboardData = vi.hoisted(() => ({
  value: {
    rfqsWaiting: [],
    invoices: [],
    activePOs: [],
    isLoading: false,
    error: null,
  },
}));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../hooks/useDashboardData', () => ({
  useDashboardData: () => mockDashboardData.value,
}));

import DashboardPage from './DashboardPage';

describe('Vendor DashboardPage', () => {
  beforeEach(() => {
    mockDashboardData.value = {
      rfqsWaiting: [],
      invoices: [],
      activePOs: [],
      isLoading: false,
      error: null,
    };
  });

  it('renders all section headers', () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('vendor.rfqsWaiting.title')).toBeInTheDocument();
    expect(screen.getByText('vendor.invoices.title')).toBeInTheDocument();
    expect(screen.getByText('vendor.activePOs.title')).toBeInTheDocument();
  });

  it('shows empty states when no data', () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('vendor.rfqsWaiting.noRfqs')).toBeInTheDocument();
    expect(screen.getByText('vendor.invoices.noInvoices')).toBeInTheDocument();
  });

  it('renders loading skeletons when loading', () => {
    mockDashboardData.value = {
      ...mockDashboardData.value,
      isLoading: true,
    };
    const { container } = render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
