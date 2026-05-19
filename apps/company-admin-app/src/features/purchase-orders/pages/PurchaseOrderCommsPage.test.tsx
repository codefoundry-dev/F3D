import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockPo = {
  id: 'po-123',
  poNumber: 'PO-ABC12345',
  projectName: 'Test Project',
  lineItems: [],
  documents: [],
};

const mockUsePurchaseOrder = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useParams: () => ({ id: 'po-123' }) };
});

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/po-shared', () => ({
  usePurchaseOrder: mockUsePurchaseOrder,
  PoCommsPage: ({
    po,
    initialTab,
  }: {
    po: { poNumber: string };
    initialTab: string;
    onTabChange: (tab: string) => void;
  }) => (
    <div data-testid="po-comms-page">
      {po.poNumber} - {initialTab}
    </div>
  ),
}));

vi.mock('@forethread/rfq-shared', () => ({
  usePageTitleStore: () => vi.fn(),
}));

vi.mock('@forethread/ui-components', () => ({
  Spinner: ({ size }: { size?: string }) => <div data-testid="spinner" data-size={size} />,
}));

import PurchaseOrderCommsPage from './PurchaseOrderCommsPage';

describe('PurchaseOrderCommsPage', () => {
  it('renders spinner while loading', () => {
    mockUsePurchaseOrder.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    render(
      <MemoryRouter>
        <PurchaseOrderCommsPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('renders error state when isError', () => {
    mockUsePurchaseOrder.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    render(
      <MemoryRouter>
        <PurchaseOrderCommsPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('detail.noData')).toBeInTheDocument();
  });

  it('renders error state when no data', () => {
    mockUsePurchaseOrder.mockReturnValue({ data: null, isLoading: false, isError: false });
    render(
      <MemoryRouter>
        <PurchaseOrderCommsPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('detail.noData')).toBeInTheDocument();
  });

  it('renders PoCommsPage with data', () => {
    mockUsePurchaseOrder.mockReturnValue({ data: mockPo, isLoading: false, isError: false });
    render(
      <MemoryRouter>
        <PurchaseOrderCommsPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('po-comms-page')).toBeInTheDocument();
    expect(screen.getByText(/PO-ABC12345/)).toBeInTheDocument();
  });

  it('defaults to messages tab', () => {
    mockUsePurchaseOrder.mockReturnValue({ data: mockPo, isLoading: false, isError: false });
    render(
      <MemoryRouter>
        <PurchaseOrderCommsPage />
      </MemoryRouter>,
    );
    expect(screen.getByText(/messages/)).toBeInTheDocument();
  });

  it('reads initial tab from search params', () => {
    mockUsePurchaseOrder.mockReturnValue({ data: mockPo, isLoading: false, isError: false });
    render(
      <MemoryRouter initialEntries={['/?tab=lineItems']}>
        <PurchaseOrderCommsPage />
      </MemoryRouter>,
    );
    expect(screen.getByText(/lineItems/)).toBeInTheDocument();
  });
});
