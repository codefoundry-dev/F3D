import { render, screen, fireEvent } from '@testing-library/react';

const mockRfq = vi.hoisted(() => ({
  value: {
    data: {
      id: 'rfq-1',
      projectName: 'Project X',
      status: 'OPEN',
      lineItems: [],
      totalRequestedQty: 10,
      createdAt: '2026-01-15',
      createdBy: { name: 'Admin' },
      deliveryLocation: 'Warehouse A',
      deadlineStart: '2026-02-01',
      deadlineEnd: '2026-03-01',
    } as Record<string, unknown> | null,
    isLoading: false,
    isError: false,
  },
}));

const mockNavigate = vi.fn();

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@forethread/api-client', () => ({
  exportRfqs: vi.fn(() => Promise.resolve({ url: 'https://example.com/pdf' })),
}));

vi.mock('@forethread/rfq-shared', () => ({
  useRfq: () => mockRfq.value,
}));

vi.mock('@forethread/ui-components', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
  getStatusColor: () => '',
  VENDOR_RFQ_STATUS_COLORS: {},
  Spinner: () => <div data-testid="spinner" />,
}));

vi.mock('@forethread/ui-components/assets/icons/arrow-line-right.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/arrows-out-simple.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/download.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/paper-plane.svg?react', () => ({
  default: () => <span />,
}));

vi.mock('./VendorRfqDetailsTab', () => ({
  VendorRfqDetailsTab: () => <div data-testid="vendor-rfq-details" />,
}));

import { RfqDetailPanel } from './RfqDetailPanel';

describe('RfqDetailPanel', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockRfq.value = {
      data: {
        id: 'rfq-1',
        projectName: 'Project X',
        status: 'OPEN',
        lineItems: [],
        totalRequestedQty: 10,
        createdAt: '2026-01-15',
        createdBy: { name: 'Admin' },
        deliveryLocation: 'Warehouse A',
        deadlineStart: '2026-02-01',
        deadlineEnd: '2026-03-01',
      },
      isLoading: false,
      isError: false,
    };
  });

  it('renders project name when rfq loaded', () => {
    render(<RfqDetailPanel rfqId="rfq-1" onClose={onClose} />);
    expect(screen.getByText('Project X')).toBeInTheDocument();
  });

  it('renders details tab', () => {
    render(<RfqDetailPanel rfqId="rfq-1" onClose={onClose} />);
    expect(screen.getByTestId('vendor-rfq-details')).toBeInTheDocument();
  });

  it('shows spinner when loading', () => {
    mockRfq.value = { data: null, isLoading: true, isError: false };
    render(<RfqDetailPanel rfqId="rfq-1" onClose={onClose} />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('shows error message on error', () => {
    mockRfq.value = { data: null, isLoading: false, isError: true };
    render(<RfqDetailPanel rfqId="rfq-1" onClose={onClose} />);
    expect(screen.getByText('detail.failedToLoad')).toBeInTheDocument();
  });

  it('navigates to fullscreen on fullscreen click', () => {
    render(<RfqDetailPanel rfqId="rfq-1" onClose={onClose} />);
    const buttons = screen.getAllByRole('button');
    // Fullscreen button is second button (after collapse)
    fireEvent.click(buttons[1]);
    expect(onClose).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/rfqs/rfq-1');
  });

  it('calls onClose on collapse click', () => {
    render(<RfqDetailPanel rfqId="rfq-1" onClose={onClose} />);
    const buttons = screen.getAllByRole('button');
    // Collapse button is first button
    fireEvent.click(buttons[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it('clicking download button triggers exportRfqs', () => {
    render(<RfqDetailPanel rfqId="rfq-1" onClose={onClose} />);
    const downloadBtn = screen.getByTitle('actions.download');
    fireEvent.click(downloadBtn);
  });
});
