import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockPo = vi.hoisted(() => ({
  value: {
    data: { id: 'po-1', poNumber: 'PO-001' } as Record<string, unknown> | null,
    isLoading: false,
    isError: false,
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useParams: () => ({ id: 'po-1' }) };
});

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/po-shared', () => ({
  usePurchaseOrder: () => mockPo.value,
  PoCommsPage: ({ po, initialTab }: { po: Record<string, unknown>; initialTab: string }) => (
    <div data-testid="po-comms-page" data-tab={initialTab}>
      {po.poNumber as string}
    </div>
  ),
}));

vi.mock('@forethread/rfq-shared', () => ({
  usePageTitleStore: () => vi.fn(),
}));

vi.mock('@forethread/ui-components', () => ({
  Spinner: () => <div data-testid="spinner" />,
}));

import PurchaseOrderCommsPage from './PurchaseOrderCommsPage';

describe('PurchaseOrderCommsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPo.value = {
      data: { id: 'po-1', poNumber: 'PO-001' },
      isLoading: false,
      isError: false,
    };
  });

  it('renders comms page with PO data', () => {
    render(
      <MemoryRouter>
        <PurchaseOrderCommsPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('po-comms-page')).toBeInTheDocument();
    expect(screen.getByText('PO-001')).toBeInTheDocument();
  });

  it('defaults to messages tab', () => {
    render(
      <MemoryRouter>
        <PurchaseOrderCommsPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('po-comms-page')).toHaveAttribute('data-tab', 'messages');
  });

  it('uses tab from search params', () => {
    render(
      <MemoryRouter initialEntries={['?tab=attachments']}>
        <PurchaseOrderCommsPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('po-comms-page')).toHaveAttribute('data-tab', 'attachments');
  });

  it('shows spinner when loading', () => {
    mockPo.value = { data: null, isLoading: true, isError: false };
    render(
      <MemoryRouter>
        <PurchaseOrderCommsPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('shows error state when error', () => {
    mockPo.value = { data: null, isLoading: false, isError: true };
    render(
      <MemoryRouter>
        <PurchaseOrderCommsPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('detail.noData')).toBeInTheDocument();
  });

  it('shows error state when no data', () => {
    mockPo.value = { data: null, isLoading: false, isError: false };
    render(
      <MemoryRouter>
        <PurchaseOrderCommsPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('detail.noData')).toBeInTheDocument();
  });
});
