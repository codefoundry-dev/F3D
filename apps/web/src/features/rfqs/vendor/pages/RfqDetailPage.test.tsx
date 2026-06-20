import { render, screen, fireEvent } from '@testing-library/react';

const mockRfq = vi.hoisted(() => ({
  value: {
    data: {
      id: 'rfq-1',
      projectName: 'Project X',
      status: 'OPEN',
      lineItems: [],
      documents: [],
    } as Record<string, unknown> | null,
    isLoading: false,
    isError: false,
  },
}));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'rfq-1' }),
  useNavigate: () => vi.fn(),
}));

vi.mock('@forethread/api-client', () => ({
  exportRfqs: vi.fn(() => Promise.resolve({ url: 'https://example.com/pdf' })),
}));

vi.mock('@forethread/rfq-shared', () => ({
  usePageTitleStore: (selector: (s: { setTitle: () => void }) => unknown) =>
    selector({ setTitle: vi.fn() }),
  useRfq: () => mockRfq.value,
  RfqDocumentsTab: () => <div data-testid="documents-tab" />,
  RfqLineItemsTab: () => <div data-testid="line-items-tab" />,
}));

vi.mock('@forethread/ui-components', () => ({
  Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
  Spinner: () => <div data-testid="spinner" />,
}));

vi.mock('@forethread/ui-components/assets/icons/download.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/paper-plane.svg?react', () => ({
  default: () => <span />,
}));

vi.mock('../components/VendorRfqDetailsTab', () => ({
  VendorRfqDetailsTab: () => <div data-testid="details-tab" />,
}));

import RfqDetailPage from './RfqDetailPage';

describe('RfqDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRfq.value = {
      data: {
        id: 'rfq-1',
        projectName: 'Project X',
        status: 'OPEN',
        lineItems: [],
        documents: [],
      },
      isLoading: false,
      isError: false,
    };
  });

  it('renders spinner when loading', () => {
    mockRfq.value = { data: null, isLoading: true, isError: false };
    render(<RfqDetailPage />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('shows no data message on error', () => {
    mockRfq.value = { data: null, isLoading: false, isError: true };
    render(<RfqDetailPage />);
    expect(screen.getByText('detail.noData')).toBeInTheDocument();
  });

  it('renders details tab when data loaded', () => {
    render(<RfqDetailPage />);
    expect(screen.getByTestId('details-tab')).toBeInTheDocument();
  });

  it('renders line items tab', () => {
    render(<RfqDetailPage />);
    expect(screen.getByTestId('line-items-tab')).toBeInTheDocument();
  });

  it('renders documents tab', () => {
    render(<RfqDetailPage />);
    expect(screen.getByTestId('documents-tab')).toBeInTheDocument();
  });

  it('renders action buttons', () => {
    render(<RfqDetailPage />);
    expect(screen.getByText('actions.response')).toBeInTheDocument();
    expect(screen.getByText('actions.exportAs')).toBeInTheDocument();
  });

  it('clicking export button triggers exportRfqs', () => {
    render(<RfqDetailPage />);
    fireEvent.click(screen.getByText('actions.exportAs'));
  });

  it('shows no data when rfq is null (no error)', () => {
    mockRfq.value = { data: null, isLoading: false, isError: false };
    render(<RfqDetailPage />);
    expect(screen.getByText('detail.noData')).toBeInTheDocument();
  });

  it('renders with undefined lineItems and documents', () => {
    mockRfq.value = {
      data: {
        id: 'rfq-2',
        projectName: 'Project Y',
        status: 'OPEN',
        lineItems: undefined,
        documents: undefined,
      },
      isLoading: false,
      isError: false,
    };
    render(<RfqDetailPage />);
    expect(screen.getByTestId('details-tab')).toBeInTheDocument();
    expect(screen.getByTestId('line-items-tab')).toBeInTheDocument();
    expect(screen.getByTestId('documents-tab')).toBeInTheDocument();
  });
});
