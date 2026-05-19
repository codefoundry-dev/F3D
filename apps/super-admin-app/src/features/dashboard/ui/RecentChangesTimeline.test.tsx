import type { AuditLogResponse } from '@forethread/api-client';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/ui-components', () => ({
  Spinner: ({ size }: { size: string }) => <div data-testid={`spinner-${size}`} />,
  formatDateTime: (dateStr: string) => `formatted:${dateStr}`,
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
}));

vi.mock('@forethread/ui-components/assets/icons/checkcircle-icon.svg?react', () => ({
  default: () => <span data-testid="check-icon" />,
}));
vi.mock('@forethread/ui-components/assets/icons/clock.svg?react', () => ({
  default: () => <span data-testid="clock-icon" />,
}));

import { RecentChangesTimeline } from './RecentChangesTimeline';

function createLog(overrides: Partial<AuditLogResponse> = {}): AuditLogResponse {
  return {
    id: 'log-1',
    action: 'USER_CREATED',
    performedById: 'u1',
    targetType: 'User',
    targetId: 'abc12345-6789',
    targetLabel: 'John Doe',
    metadata: null,
    ipAddress: null,
    createdAt: '2026-03-10T10:00:00Z',
    performedBy: { id: 'u1', name: 'Admin User', email: 'admin@test.com' },
    ...overrides,
  };
}

describe('RecentChangesTimeline', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders loading spinner when isLoading is true', () => {
    render(<RecentChangesTimeline logs={[]} isLoading={true} />);

    expect(screen.getByTestId('spinner-md')).toBeInTheDocument();
  });

  it('renders empty state when no logs and not loading', () => {
    render(<RecentChangesTimeline logs={[]} isLoading={false} />);

    expect(screen.getByText('recentChanges.noChanges')).toBeInTheDocument();
  });

  it('renders section title', () => {
    render(<RecentChangesTimeline logs={[]} isLoading={false} />);

    expect(screen.getByText('recentChanges.title')).toBeInTheDocument();
  });

  it('renders log entries with mapped action labels', () => {
    const logs = [createLog({ action: 'USER_CREATED' })];
    render(<RecentChangesTimeline logs={logs} isLoading={false} />);

    expect(screen.getByText('User created')).toBeInTheDocument();
  });

  it('falls back to raw action name for unknown actions', () => {
    const logs = [createLog({ action: 'UNKNOWN_ACTION' })];
    render(<RecentChangesTimeline logs={logs} isLoading={false} />);

    expect(screen.getByText('UNKNOWN_ACTION')).toBeInTheDocument();
  });

  it('renders performer name and avatar initial', () => {
    const logs = [createLog({ performedBy: { id: 'u1', name: 'Jane Smith', email: 'j@t.com' } })];
    render(<RecentChangesTimeline logs={logs} isLoading={false} />);

    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('J')).toBeInTheDocument();
  });

  it('renders formatted date', () => {
    const logs = [createLog({ createdAt: '2026-03-10T10:00:00Z' })];
    render(<RecentChangesTimeline logs={logs} isLoading={false} />);

    expect(screen.getByText('formatted:2026-03-10T10:00:00Z')).toBeInTheDocument();
  });

  it('renders target label when available', () => {
    const logs = [createLog({ targetType: 'User', targetLabel: 'John Doe' })];
    render(<RecentChangesTimeline logs={logs} isLoading={false} />);

    expect(screen.getByText('User: John Doe')).toBeInTheDocument();
  });

  it('renders truncated targetId when targetLabel is null', () => {
    const logs = [
      createLog({ targetType: 'Company', targetLabel: null, targetId: 'abcdefgh-1234' }),
    ];
    render(<RecentChangesTimeline logs={logs} isLoading={false} />);

    expect(screen.getByText('Company abcdefgh')).toBeInTheDocument();
  });

  it('renders multiple log entries', () => {
    const logs = [
      createLog({
        id: 'log-1',
        action: 'USER_CREATED',
        performedBy: { id: 'u1', name: 'Alice', email: 'a@t.com' },
      }),
      createLog({
        id: 'log-2',
        action: 'COMPANY_CREATED',
        performedBy: { id: 'u2', name: 'Bob', email: 'b@t.com' },
      }),
    ];
    render(<RecentChangesTimeline logs={logs} isLoading={false} />);

    expect(screen.getByText('User created')).toBeInTheDocument();
    expect(screen.getByText('Company created')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('renders connecting lines between entries except for the last one', () => {
    const logs = [createLog({ id: 'log-1' }), createLog({ id: 'log-2' })];
    const { container } = render(<RecentChangesTimeline logs={logs} isLoading={false} />);

    // The connector line has class "w-0.5 flex-1 bg-border"
    const connectors = container.querySelectorAll('.bg-border.flex-1');
    // Only 1 connector for 2 entries (last entry has no connector)
    expect(connectors).toHaveLength(1);
  });
});
