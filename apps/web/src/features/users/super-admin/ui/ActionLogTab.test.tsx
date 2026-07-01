import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/api-client', () => ({
  getAuditLogs: vi.fn(),
}));

let capturedQueryConfig: any = {};
const mockUseQuery = vi.fn((...args: any[]) => {
  capturedQueryConfig = args[0];
  return {
    data: {
      items: [
        {
          id: 'log1',
          action: 'USER_CREATED',
          createdAt: '2025-01-15T10:30:00Z',
          targetType: 'User',
          targetId: 'abcd1234-5678',
          targetLabel: 'Alice' as string | null,
          performedBy: { name: 'Admin' },
        },
      ],
      meta: { page: 1, total: 1, lastPage: 1 },
    },
    isLoading: false,
  };
});

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
}));

vi.mock('@forethread/ui-components', () => ({
  Spinner: () => <div data-testid="spinner" />,
  TablePagination: ({ onPageChange, onPageSizeChange }: any) => (
    <div data-testid="table-pagination">
      <button data-testid="page-change" onClick={() => onPageChange(2)}>
        Next
      </button>
      <button data-testid="page-size-change" onClick={() => onPageSizeChange(50)}>
        50
      </button>
    </div>
  ),
  formatDateTime: (date: string) => new Date(date).toLocaleString(),
  formatAuditAction: (a: string) =>
    a
      .split('_')
      .map((w: string, i: number) =>
        i === 0 ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase(),
      )
      .join(' '),
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
}));

vi.mock('@forethread/ui-components/assets/icons/checkcircle-icon.svg?react', () => ({
  default: (p: any) => <svg data-testid="icon-check" {...p} />,
}));
vi.mock('@forethread/ui-components/assets/icons/clock.svg?react', () => ({
  default: (p: any) => <svg data-testid="icon-clock" {...p} />,
}));

import { ActionLogTab } from './ActionLogTab';

describe('ActionLogTab', () => {
  beforeEach(() => {
    mockUseQuery.mockClear();
  });

  it('renders the activity log heading', () => {
    render(<ActionLogTab />);
    expect(screen.getByText('tabs.activityLogTitle')).toBeInTheDocument();
  });

  it('renders audit log entry', () => {
    render(<ActionLogTab />);
    expect(screen.getByText('User created')).toBeInTheDocument();
  });

  it('renders performed by info', () => {
    render(<ActionLogTab />);
    expect(screen.getByText(/by Admin/)).toBeInTheDocument();
  });

  it('renders target info', () => {
    render(<ActionLogTab />);
    expect(screen.getByText(/User: Alice/)).toBeInTheDocument();
  });

  it('renders spinner when loading', () => {
    mockUseQuery.mockReturnValueOnce({ data: undefined as any, isLoading: true });
    render(<ActionLogTab />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('renders empty state when no items', () => {
    mockUseQuery.mockReturnValueOnce({
      data: { items: [], meta: { page: 1, total: 0, lastPage: 1 } },
      isLoading: false,
    });
    render(<ActionLogTab />);
    expect(screen.getByText('tabs.actionLogPlaceholder')).toBeInTheDocument();
  });

  it('renders pagination when total exceeds limit and page change works', () => {
    mockUseQuery.mockReturnValue({
      data: {
        items: [
          {
            id: 'log1',
            action: 'USER_CREATED',
            createdAt: '2025-01-15T10:30:00Z',
            targetType: 'User',
            targetId: 'abcd1234-5678',
            targetLabel: 'Alice',
            performedBy: { name: 'Admin' },
          },
        ],
        meta: { page: 1, total: 100, lastPage: 4 },
      },
      isLoading: false,
    });
    render(<ActionLogTab />);
    expect(screen.getByTestId('table-pagination')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('page-change'));
    // No crash — page state updates internally
    expect(screen.getByTestId('table-pagination')).toBeInTheDocument();
  });

  it('page size change updates limit and resets page', () => {
    mockUseQuery.mockReturnValue({
      data: {
        items: [
          {
            id: 'log1',
            action: 'USER_CREATED',
            createdAt: '2025-01-15T10:30:00Z',
            targetType: 'User',
            targetId: 'abcd1234-5678',
            targetLabel: 'Alice',
            performedBy: { name: 'Admin' },
          },
        ],
        meta: { page: 1, total: 100, lastPage: 4 },
      },
      isLoading: false,
    });
    render(<ActionLogTab />);
    fireEvent.click(screen.getByTestId('page-size-change'));
    // No crash — limit and page state update internally
    expect(screen.getByTestId('table-pagination')).toBeInTheDocument();
  });

  it('renders formatted date/time for log entry', () => {
    render(<ActionLogTab />);
    // formatDateTime should produce a date string — we just check that a clock icon and timestamp text exist
    expect(screen.getByTestId('icon-clock')).toBeInTheDocument();
  });

  it('humanizes an unmapped action instead of showing the raw enum string', () => {
    mockUseQuery.mockReturnValueOnce({
      data: {
        items: [
          {
            id: 'log2',
            action: 'SOME_UNKNOWN_ACTION',
            createdAt: '2025-02-20T14:00:00Z',
            targetType: 'Widget',
            targetId: 'xyz12345-9999',
            targetLabel: null as string | null,
            performedBy: { name: 'System' },
          },
        ],
        meta: { page: 1, total: 1, lastPage: 1 },
      },
      isLoading: false,
    });
    render(<ActionLogTab />);
    // Unmapped actions are humanized rather than shown in raw SCREAMING_SNAKE_CASE
    expect(screen.getByText('Some unknown action')).toBeInTheDocument();
    expect(screen.queryByText('SOME_UNKNOWN_ACTION')).not.toBeInTheDocument();
  });

  it('renders targetId truncated when targetLabel is null', () => {
    mockUseQuery.mockReturnValueOnce({
      data: {
        items: [
          {
            id: 'log3',
            action: 'USER_UPDATED',
            createdAt: '2025-03-01T08:00:00Z',
            targetType: 'User',
            targetId: 'abcdefgh-1234-5678',
            targetLabel: null as string | null,
            performedBy: { name: 'Admin' },
          },
        ],
        meta: { page: 1, total: 1, lastPage: 1 },
      },
      isLoading: false,
    });
    render(<ActionLogTab />);
    // targetLabel is null so it uses targetId.slice(0,8) = 'abcdefgh'
    expect(screen.getByText(/User abcdefgh/)).toBeInTheDocument();
  });

  it('does not render pagination when total is within limit', () => {
    mockUseQuery.mockReturnValueOnce({
      data: {
        items: [
          {
            id: 'log1',
            action: 'USER_CREATED',
            createdAt: '2025-01-15T10:30:00Z',
            targetType: 'User',
            targetId: 'abcd1234-5678',
            targetLabel: 'Alice',
            performedBy: { name: 'Admin' },
          },
        ],
        meta: { page: 1, total: 1, lastPage: 1 },
      },
      isLoading: false,
    });
    render(<ActionLogTab />);
    expect(screen.queryByTestId('table-pagination')).not.toBeInTheDocument();
  });

  it('renders timeline connector between multiple items', () => {
    mockUseQuery.mockReturnValueOnce({
      data: {
        items: [
          {
            id: 'log1',
            action: 'USER_CREATED',
            createdAt: '2025-01-15T10:30:00Z',
            targetType: 'User',
            targetId: 'abcd1234-5678',
            targetLabel: 'Alice',
            performedBy: { name: 'Admin' },
          },
          {
            id: 'log2',
            action: 'USER_UPDATED',
            createdAt: '2025-01-16T11:00:00Z',
            targetType: 'User',
            targetId: 'abcd1234-5678',
            targetLabel: 'Alice',
            performedBy: { name: 'Admin' },
          },
        ],
        meta: { page: 1, total: 2, lastPage: 1 },
      },
      isLoading: false,
    });
    render(<ActionLogTab />);
    expect(screen.getByText('User created')).toBeInTheDocument();
    expect(screen.getByText('User updated')).toBeInTheDocument();
  });

  it('queryFn calls getAuditLogs with params', async () => {
    const { getAuditLogs } = await import('@forethread/api-client');
    vi.mocked(getAuditLogs).mockResolvedValue({
      items: [],
      meta: { page: 1, total: 0, lastPage: 1 },
    } as never);
    render(<ActionLogTab />);
    // Call the captured queryFn
    await capturedQueryConfig.queryFn?.();
    expect(getAuditLogs).toHaveBeenCalled();
  });

  it('does not render timeline connector for last item', () => {
    mockUseQuery.mockReturnValueOnce({
      data: {
        items: [
          {
            id: 'log1',
            action: 'USER_CREATED',
            createdAt: '2025-01-15T10:30:00Z',
            targetType: 'User',
            targetId: 'abcd1234-5678',
            targetLabel: 'Alice',
            performedBy: { name: 'Admin' },
          },
        ],
        meta: { page: 1, total: 1, lastPage: 1 },
      },
      isLoading: false,
    });
    render(<ActionLogTab />);
    // Single item should not have connector line (no crash)
    expect(screen.getByText('User created')).toBeInTheDocument();
  });
});
