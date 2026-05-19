const mockNavigate = vi.hoisted(() => vi.fn());
const mockRfqData = vi.hoisted(() => ({
  value: {
    data: {
      id: 'rfq-1',
      projectName: 'Project A',
      status: 'OPEN',
      lineItems: [],
      quoteResponses: [],
      documents: [],
    },
    isLoading: false,
    isError: false,
  } as Record<string, unknown>,
}));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@forethread/api-client', () => ({
  exportRfqs: vi.fn().mockResolvedValue({ url: 'https://example.com/export.pdf' }),
}));

vi.mock('@forethread/rfq-shared', () => ({
  useRfq: () => mockRfqData.value,
  RfqDetailTabs: ({
    activeTab: _activeTab,
    onTabChange,
  }: {
    activeTab: string;
    onTabChange: (tab: string) => void;
  }) => (
    <div data-testid="tabs">
      <button onClick={() => onTabChange('details')}>details</button>
      <button onClick={() => onTabChange('lineItems')}>lineItems</button>
      <button onClick={() => onTabChange('responses')}>responses</button>
      <button onClick={() => onTabChange('documents')}>documents</button>
    </div>
  ),
  RfqDocumentsTab: () => <div data-testid="documents-tab" />,
  RfqLineItemsTab: () => <div data-testid="lineitems-tab" />,
  RfqResponsesTab: () => <div data-testid="responses-tab" />,
}));

vi.mock('@forethread/ui-components', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
  getStatusColor: () => '',
  RFQ_STATUS_COLORS: {},
  Spinner: () => <div data-testid="spinner" />,
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
}));

vi.mock('./RfqDetailsTab', () => ({
  RfqDetailsTab: () => <div data-testid="details-tab" />,
}));

import { render, screen, fireEvent } from '@testing-library/react';

import { RfqDetailPanel } from './RfqDetailPanel';

describe('RfqDetailPanel', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    onClose.mockClear();
    mockNavigate.mockClear();
    mockRfqData.value = {
      data: {
        id: 'rfq-1',
        projectName: 'Project A',
        status: 'OPEN',
        lineItems: [],
        quoteResponses: [],
        documents: [],
      },
      isLoading: false,
      isError: false,
    };
  });

  it('shows spinner when loading', () => {
    mockRfqData.value.isLoading = true;
    mockRfqData.value.data = null;
    render(<RfqDetailPanel rfqId="rfq-1" onClose={onClose} />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('shows error when request fails', () => {
    mockRfqData.value.isError = true;
    mockRfqData.value.data = null;
    render(<RfqDetailPanel rfqId="rfq-1" onClose={onClose} />);
    expect(screen.getByText('detail.failedToLoad')).toBeInTheDocument();
  });

  it('renders RFQ details', () => {
    render(<RfqDetailPanel rfqId="rfq-1" onClose={onClose} />);
    expect(screen.getByText('Project A')).toBeInTheDocument();
    expect(screen.getByTestId('details-tab')).toBeInTheDocument();
  });

  it('navigates to fullscreen on expand', () => {
    render(<RfqDetailPanel rfqId="rfq-1" onClose={onClose} />);
    const fullscreenBtn = screen.getByTitle('actions.fullscreen');
    fireEvent.click(fullscreenBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/rfqs/rfq-1');
  });

  it('calls onClose on collapse', () => {
    render(<RfqDetailPanel rfqId="rfq-1" onClose={onClose} />);
    const collapseBtn = screen.getByTitle('actions.collapse');
    fireEvent.click(collapseBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it('switches tabs', () => {
    render(<RfqDetailPanel rfqId="rfq-1" onClose={onClose} />);
    fireEvent.click(screen.getByText('lineItems'));
    expect(screen.getByTestId('lineitems-tab')).toBeInTheDocument();

    fireEvent.click(screen.getByText('responses'));
    expect(screen.getByTestId('responses-tab')).toBeInTheDocument();

    fireEvent.click(screen.getByText('documents'));
    expect(screen.getByTestId('documents-tab')).toBeInTheDocument();
  });

  it('clicks download button which calls exportRfqs', async () => {
    const { exportRfqs } =
      await vi.importMock<typeof import('@forethread/api-client')>('@forethread/api-client');
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<RfqDetailPanel rfqId="rfq-1" onClose={onClose} />);
    const downloadBtn = screen.getByTitle('actions.download');
    fireEvent.click(downloadBtn);
    expect(vi.mocked(exportRfqs)).toHaveBeenCalledWith('pdf', { search: 'rfq-1' });
    openSpy.mockRestore();
  });

  it('calls onClose then navigates on fullscreen (handleFullscreen)', () => {
    render(<RfqDetailPanel rfqId="rfq-1" onClose={onClose} />);
    fireEvent.click(screen.getByTitle('actions.fullscreen'));
    expect(onClose).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/rfqs/rfq-1');
  });
});
