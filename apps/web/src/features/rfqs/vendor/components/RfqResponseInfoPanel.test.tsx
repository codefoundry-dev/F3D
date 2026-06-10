import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/rfq-shared', () => ({
  DetailField: ({ label, value }: { label: string; value: string }) => (
    <div>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  ),
  SectionTitle: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
  formatDate: (d: string) => d,
  RfqDocumentsTab: ({ rfqId }: { rfqId: string; documents: unknown[]; hideUpload: boolean }) => (
    <div data-testid="documents-tab">{rfqId}</div>
  ),
}));

vi.mock('@forethread/ui-components', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => (
    <span data-testid="badge">{children}</span>
  ),
  NEUTRAL_STATUS_COLOR: '',
}));

vi.mock('@forethread/ui-components/assets/icons/cross.svg?react', () => ({
  default: () => <span data-testid="cross-icon" />,
}));

import { RfqResponseInfoPanel } from './RfqResponseInfoPanel';

const rfq = {
  id: 'rfq-1',
  name: 'RFQ-001',
  projectName: 'Project X',
  status: 'OPEN',
  createdAt: '2026-01-15',
  createdBy: { name: 'Contractor Corp' },
  deliveryLocation: 'Warehouse A',
  deadlineStart: '2026-02-01',
  deadlineEnd: '2026-03-01',
  pickUp: true,
  documents: [],
  needByDate: '2026-04-01',
  lineItems: [],
} as never;

describe('RfqResponseInfoPanel', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders RFQ details section title', () => {
    render(<RfqResponseInfoPanel rfq={rfq} onClose={onClose} />);
    expect(screen.getByText('detailFields.rfqDetails')).toBeInTheDocument();
  });

  it('renders RFQ ID', () => {
    render(<RfqResponseInfoPanel rfq={rfq} onClose={onClose} />);
    expect(screen.getAllByText('rfq-1').length).toBeGreaterThanOrEqual(1);
  });

  it('renders contractor name', () => {
    render(<RfqResponseInfoPanel rfq={rfq} onClose={onClose} />);
    // Appears as both company and contact
    const matches = screen.getAllByText('Contractor Corp');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders status badge', () => {
    render(<RfqResponseInfoPanel rfq={rfq} onClose={onClose} />);
    expect(screen.getByTestId('badge')).toBeInTheDocument();
  });

  it('renders documents section', () => {
    render(<RfqResponseInfoPanel rfq={rfq} onClose={onClose} />);
    expect(screen.getByText('documentsTab.title')).toBeInTheDocument();
    expect(screen.getByTestId('documents-tab')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    render(<RfqResponseInfoPanel rfq={rfq} onClose={onClose} />);
    const closeBtn = screen.getByTestId('cross-icon').closest('button')!;
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it('renders project name', () => {
    render(<RfqResponseInfoPanel rfq={rfq} onClose={onClose} />);
    expect(screen.getByText('Project X')).toBeInTheDocument();
  });

  it('renders delivery location', () => {
    render(<RfqResponseInfoPanel rfq={rfq} onClose={onClose} />);
    expect(screen.getByText('Warehouse A')).toBeInTheDocument();
  });

  it('renders need by date when present', () => {
    render(<RfqResponseInfoPanel rfq={rfq} onClose={onClose} />);
    expect(screen.getByText('2026-04-01')).toBeInTheDocument();
  });

  it('does not render need by date when absent', () => {
    const rfqNoNeedBy = { ...(rfq as Record<string, unknown>), needByDate: null } as never;
    render(<RfqResponseInfoPanel rfq={rfqNoNeedBy} onClose={onClose} />);
    expect(screen.queryByText('response.needByDate')).not.toBeInTheDocument();
  });
});
