// ── Hoisted mocks ────────────────────────────────────────────────────────────

const mockUseEmailLog = vi.hoisted(() => vi.fn());

// ── Module mocks (before imports) ────────────────────────────────────────────

vi.mock('../hooks/usePurchaseOrders', () => ({
  usePurchaseOrderEmailLog: mockUseEmailLog,
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

// ── Imports ──────────────────────────────────────────────────────────────────

import { render, screen } from '@testing-library/react';

import { PoEmailLogTab } from './PoEmailLogTab';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const deliveredEntry = {
  id: 'em-1',
  toEmail: 'vendor@acme.test',
  subject: 'PO-001 issued',
  template: 'po-issued',
  status: 'DELIVERED',
  sentAt: '2026-06-01T10:00:00Z',
  deliveredAt: '2026-06-01T10:01:00Z',
  openedAt: null,
  bouncedAt: null,
  openCount: 3,
  bounceReason: null,
  lastEventAt: '2026-06-01T10:01:00Z',
  createdAt: '2026-06-01T10:00:00Z',
  events: [],
};

const bouncedEntry = {
  id: 'em-2',
  toEmail: 'typo@acme.test',
  subject: 'PO-002 issued',
  template: 'po-issued',
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

// ── Tests ────────────────────────────────────────────────────────────────────

describe('PoEmailLogTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a spinner while loading', () => {
    mockReturn({ data: undefined, isLoading: true, isError: false });
    render(<PoEmailLogTab poId="po-1" />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('renders an error message on failure', () => {
    mockReturn({ data: undefined, isLoading: false, isError: true });
    render(<PoEmailLogTab poId="po-1" />);
    expect(screen.getByText('emailLogTab.loadError')).toBeInTheDocument();
  });

  it('renders an empty state when there are no entries', () => {
    mockReturn({ data: [], isLoading: false, isError: false });
    render(<PoEmailLogTab poId="po-1" />);
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByText('emailLogTab.empty')).toBeInTheDocument();
  });

  it('renders a row per email with recipient, subject, status badge, sent time and opens', () => {
    mockReturn({ data: [deliveredEntry], isLoading: false, isError: false });
    render(<PoEmailLogTab poId="po-1" />);

    expect(screen.getByText('vendor@acme.test')).toBeInTheDocument();
    expect(screen.getByText('PO-001 issued')).toBeInTheDocument();
    expect(screen.getByTestId('badge')).toHaveTextContent('DELIVERED');
    expect(screen.getByText('dt:2026-06-01T10:00:00Z')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('uses a positive badge colour for delivered emails', () => {
    mockReturn({ data: [deliveredEntry], isLoading: false, isError: false });
    render(<PoEmailLogTab poId="po-1" />);
    expect(screen.getByTestId('badge').className).toContain('text-success');
  });

  it('does NOT show the bounce alert when all emails delivered', () => {
    mockReturn({ data: [deliveredEntry], isLoading: false, isError: false });
    render(<PoEmailLogTab poId="po-1" />);
    expect(screen.queryByTestId('alert')).not.toBeInTheDocument();
  });

  it('surfaces a destructive bounce alert with the reason for failed deliveries (AC #4)', () => {
    mockReturn({ data: [deliveredEntry, bouncedEntry], isLoading: false, isError: false });
    render(<PoEmailLogTab poId="po-1" />);

    const alert = screen.getByTestId('alert');
    expect(alert).toHaveAttribute('data-variant', 'destructive');
    expect(alert).toHaveTextContent('typo@acme.test — Mailbox does not exist');
  });

  it('flags the bounced row with a destructive badge colour', () => {
    mockReturn({ data: [bouncedEntry], isLoading: false, isError: false });
    render(<PoEmailLogTab poId="po-1" />);
    expect(screen.getByTestId('badge').className).toContain('text-destructive');
    // bounce reason is shown inline on the flagged row too
    expect(screen.getAllByText('Mailbox does not exist').length).toBeGreaterThan(0);
  });
});
