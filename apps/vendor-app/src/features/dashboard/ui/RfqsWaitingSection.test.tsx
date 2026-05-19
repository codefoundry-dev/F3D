import type { VendorRfqItem } from '@forethread/api-client';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

import { RfqsWaitingSection } from './RfqsWaitingSection';

const mockItems: VendorRfqItem[] = [
  {
    id: '1',
    companyName: 'BuildCo',
    companyCountry: 'US',
    rfqId: 'RFQ-100',
    projectName: 'Tower Project',
    dateRange: '2026-01-01 - 2026-03-01',
    totalCost: 25000,
    itemCount: 10,
    deliveryLocation: 'Dubai',
  },
];

describe('RfqsWaitingSection', () => {
  it('renders section title', () => {
    render(
      <MemoryRouter>
        <RfqsWaitingSection items={[]} />
      </MemoryRouter>,
    );
    expect(screen.getByText('vendor.rfqsWaiting.title')).toBeInTheDocument();
  });

  it('shows empty state when no items', () => {
    render(
      <MemoryRouter>
        <RfqsWaitingSection items={[]} />
      </MemoryRouter>,
    );
    expect(screen.getByText('vendor.rfqsWaiting.noRfqs')).toBeInTheDocument();
  });

  it('renders RFQ cards with data', () => {
    render(
      <MemoryRouter>
        <RfqsWaitingSection items={mockItems} />
      </MemoryRouter>,
    );
    expect(screen.getByText('BuildCo')).toBeInTheDocument();
    expect(screen.getByText('RFQ-100')).toBeInTheDocument();
    expect(screen.getByText('Dubai')).toBeInTheDocument();
  });

  it('renders Response button', () => {
    render(
      <MemoryRouter>
        <RfqsWaitingSection items={mockItems} />
      </MemoryRouter>,
    );
    expect(screen.getByText('vendor.rfqsWaiting.response')).toBeInTheDocument();
  });

  it('shows loading skeletons when isLoading', () => {
    const { container } = render(
      <MemoryRouter>
        <RfqsWaitingSection items={[]} isLoading />
      </MemoryRouter>,
    );
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('clicking response button navigates to rfq detail', () => {
    render(
      <MemoryRouter>
        <RfqsWaitingSection items={mockItems} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText('vendor.rfqsWaiting.response'));
    expect(mockNavigate).toHaveBeenCalledWith('/rfqs/1');
  });

  it('clicking card navigates to rfq detail', () => {
    render(
      <MemoryRouter>
        <RfqsWaitingSection items={mockItems} />
      </MemoryRouter>,
    );
    // The DashboardItemCard onCardClick should be triggered by clicking the card
    fireEvent.click(screen.getByText('BuildCo'));
    expect(mockNavigate).toHaveBeenCalledWith('/rfqs/1');
  });

  it('renders dash when dateRange is null', () => {
    const itemsWithNulls: VendorRfqItem[] = [
      {
        id: '2',
        companyName: 'NullCo',
        companyCountry: 'AU',
        rfqId: 'RFQ-200',
        projectName: 'Null Project',
        dateRange: null as unknown as string,
        totalCost: 0,
        itemCount: 1,
        deliveryLocation: null as unknown as string,
      },
    ];
    render(
      <MemoryRouter>
        <RfqsWaitingSection items={itemsWithNulls} />
      </MemoryRouter>,
    );
    expect(screen.getByText('NullCo')).toBeInTheDocument();
    // itemCount === 1 should render "1 item" (singular)
    expect(screen.getByText('1 item')).toBeInTheDocument();
    // null dateRange and deliveryLocation render as '-'
    const dashes = screen.getAllByText('-');
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it('renders plural items text when itemCount > 1', () => {
    render(
      <MemoryRouter>
        <RfqsWaitingSection items={mockItems} />
      </MemoryRouter>,
    );
    expect(screen.getByText('10 items')).toBeInTheDocument();
  });
});
