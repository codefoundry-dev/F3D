import { render, screen } from '@testing-library/react';

const mockUseEmailLog = vi.hoisted(() => vi.fn());

vi.mock('@forethread/rfq-shared', () => ({
  useRfqEmailLog: mockUseEmailLog,
}));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts && typeof opts.count === 'number') return `${key} (${opts.count})`;
      if (opts && 'email' in opts) return `${String(opts.email)} — ${String(opts.reason)}`;
      return key;
    },
  }),
}));

vi.mock('@forethread/shared-types/client', () => ({
  EmailDeliveryStatus: {
    QUEUED: 'QUEUED',
    SENT: 'SENT',
    DELIVERED: 'DELIVERED',
    DELIVERY_DELAYED: 'DELIVERY_DELAYED',
    OPENED: 'OPENED',
    CLICKED: 'CLICKED',
    BOUNCED: 'BOUNCED',
    COMPLAINED: 'COMPLAINED',
    FAILED: 'FAILED',
  },
}));

vi.mock('@forethread/ui-components', () => ({
  Alert: ({ children, variant }: any) => (
    <div data-testid="alert" data-variant={variant}>
      {children}
    </div>
  ),
  Badge: ({ children, className }: any) => (
    <span data-testid="badge" className={className}>
      {children}
    </span>
  ),
  EmptyState: ({ title, description }: any) => (
    <div data-testid="empty-state">
      <span>{title}</span>
      <span>{description}</span>
    </div>
  ),
  Spinner: () => <div data-testid="spinner" />,
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
  formatDateTime: (v: string) => `dt:${v}`,
  formatStatus: (v: string) => v,
}));

vi.mock('@forethread/ui-components/assets/icons/cross-in-circle.svg?react', () => ({
  default: () => <span data-testid="icon-alert" />,
}));

import { RfqEmailLogTab } from './RfqEmailLogTab';

const deliveredEntry = {
  id: 'em-1',
  toEmail: 'vendor@acme.test',
  subject: 'RFQ-001 invitation',
  template: 'rfq-received',
  status: 'OPENED',
  sentAt: '2026-06-01T10:00:00Z',
  deliveredAt: '2026-06-01T10:01:00Z',
  openedAt: '2026-06-01T11:00:00Z',
  bouncedAt: null,
  openCount: 2,
  bounceReason: null,
  lastEventAt: '2026-06-01T11:00:00Z',
  createdAt: '2026-06-01T10:00:00Z',
  events: [],
};

const bouncedEntry = {
  id: 'em-2',
  toEmail: 'typo@acme.test',
  subject: 'RFQ-002 invitation',
  template: 'rfq-received',
  status: 'BOUNCED',
  sentAt: '2026-06-02T10:00:00Z',
  deliveredAt: null,
  openedAt: null,
  bouncedAt: '2026-06-02T10:02:00Z',
  openCount: 0,
  bounceReason: 'Mailbox does not exist',
  lastEventAt: '2026-06-02T10:02:00Z',
  createdAt: '2026-06-02T10:00:00Z',
  events: [],
};

function mockReturn(value: Record<string, unknown>) {
  mockUseEmailLog.mockReturnValue(value);
}

describe('RfqEmailLogTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a spinner while loading', () => {
    mockReturn({ data: undefined, isLoading: true, isError: false });
    render(<RfqEmailLogTab rfqId="rfq-1" />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('renders an error message on failure', () => {
    mockReturn({ data: undefined, isLoading: false, isError: true });
    render(<RfqEmailLogTab rfqId="rfq-1" />);
    expect(screen.getByText('emailLogTab.loadError')).toBeInTheDocument();
  });

  it('renders an empty state when there are no entries', () => {
    mockReturn({ data: [], isLoading: false, isError: false });
    render(<RfqEmailLogTab rfqId="rfq-1" />);
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
  });

  it('renders a row per email with recipient, subject, status badge and opens', () => {
    mockReturn({ data: [deliveredEntry], isLoading: false, isError: false });
    render(<RfqEmailLogTab rfqId="rfq-1" />);

    expect(screen.getByText('vendor@acme.test')).toBeInTheDocument();
    expect(screen.getByText('RFQ-001 invitation')).toBeInTheDocument();
    expect(screen.getByTestId('badge')).toHaveTextContent('OPENED');
    expect(screen.getByText('dt:2026-06-01T10:00:00Z')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('uses a positive badge colour for opened emails', () => {
    mockReturn({ data: [deliveredEntry], isLoading: false, isError: false });
    render(<RfqEmailLogTab rfqId="rfq-1" />);
    expect(screen.getByTestId('badge').className).toContain('text-success');
  });

  it('does NOT show the bounce alert when all emails delivered', () => {
    mockReturn({ data: [deliveredEntry], isLoading: false, isError: false });
    render(<RfqEmailLogTab rfqId="rfq-1" />);
    expect(screen.queryByTestId('alert')).not.toBeInTheDocument();
  });

  it('surfaces a destructive bounce alert with the reason for failed deliveries (AC #4)', () => {
    mockReturn({ data: [deliveredEntry, bouncedEntry], isLoading: false, isError: false });
    render(<RfqEmailLogTab rfqId="rfq-1" />);

    const alert = screen.getByTestId('alert');
    expect(alert).toHaveAttribute('data-variant', 'destructive');
    expect(alert).toHaveTextContent('typo@acme.test — Mailbox does not exist');
  });

  it('flags the bounced row with a destructive badge colour', () => {
    mockReturn({ data: [bouncedEntry], isLoading: false, isError: false });
    render(<RfqEmailLogTab rfqId="rfq-1" />);
    expect(screen.getByTestId('badge').className).toContain('text-destructive');
  });
});
