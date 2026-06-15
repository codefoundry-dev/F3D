import type { MrListItem } from '@forethread/api-client';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockNavigate = vi.hoisted(() => vi.fn());
const mockUseMaterialRequests = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
  }),
}));
vi.mock('@forethread/ui-components', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    leftIcon: _leftIcon,
    rightIcon: _rightIcon,
    isLoading: _isLoading,
    variant: _variant,
    size: _size,
    ...props
  }: Record<string, unknown>) => (
    <button onClick={onClick as () => void} disabled={disabled as boolean} {...props}>
      {children as ReactNode}
    </button>
  ),
  FilterChip: ({
    label,
    active,
    onClick,
  }: {
    label: string;
    active?: boolean;
    onClick?: () => void;
  }) => (
    <button data-active={active} onClick={onClick}>
      {label}
    </button>
  ),
  Spinner: () => <div data-testid="spinner" />,
  TablePagination: ({ totalItems }: { totalItems: number }) => (
    <div data-testid="pagination">total:{totalItems}</div>
  ),
  formatDate: (d: string) => d,
}));
vi.mock('@forethread/ui-components/assets/icons/eye-opened.svg?react', () => ({
  default: () => <svg />,
}));
vi.mock('@/app/route-config', () => ({
  ROUTES: {
    materialRequestJobs: '/material-requests/jobs',
    materialRequestDetail: '/material-requests/:id',
  },
}));
vi.mock('../components/MrStatusBadge', () => ({
  MrStatusBadge: ({ status }: { status: string }) => <span>status:{status}</span>,
  MrPriorityBadge: ({ priority }: { priority: string }) => <span>prio:{priority}</span>,
}));
vi.mock('../../services/material-requests.service', () => ({
  useMaterialRequests: (params: unknown) => mockUseMaterialRequests(params),
}));

import OfficerDashboardPage from './OfficerDashboardPage';

const NOW_ISO = new Date().toISOString();

function item(overrides: Partial<MrListItem>): MrListItem {
  return {
    id: 'mr-1',
    mrNumber: 'MR-0001',
    status: 'SUBMITTED',
    priority: 'HIGH',
    projectId: 'p1',
    project: { id: 'p1', name: 'Downtown Office' },
    requestedBy: { id: 'u1', name: 'John Foreman' },
    lineItemCount: 4,
    neededByDate: '2026-07-01',
    createdAt: NOW_ISO,
    ...overrides,
  };
}

describe('OfficerDashboardPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the spinner while loading', () => {
    mockUseMaterialRequests.mockReturnValue({ isLoading: true });
    render(<OfficerDashboardPage />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('renders the empty state when there are no requests', () => {
    mockUseMaterialRequests.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { items: [] },
    });
    render(<OfficerDashboardPage />);
    expect(screen.getByText('officer.empty')).toBeInTheDocument();
  });

  it('shows the error state on failure', () => {
    mockUseMaterialRequests.mockReturnValue({ isLoading: false, isError: true, data: undefined });
    render(<OfficerDashboardPage />);
    expect(screen.getByText('officer.loadFailed')).toBeInTheDocument();
  });

  it('lists requests with number, project, requester, status and items', () => {
    mockUseMaterialRequests.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { items: [item({})] },
    });
    render(<OfficerDashboardPage />);
    const table = screen.getByTestId('mr-officer-table');
    expect(within(table).getByText('MR-0001')).toBeInTheDocument();
    expect(within(table).getByText('Downtown Office')).toBeInTheDocument();
    expect(within(table).getByText('John Foreman')).toBeInTheDocument();
    expect(within(table).getByText('status:SUBMITTED')).toBeInTheDocument();
  });

  it('navigates to the detail page when a row is clicked', () => {
    mockUseMaterialRequests.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { items: [item({ id: 'mr-42' })] },
    });
    render(<OfficerDashboardPage />);
    fireEvent.click(screen.getByTestId('mr-view-mr-42'));
    expect(mockNavigate).toHaveBeenCalledWith('/material-requests/mr-42');
  });

  it('Create button routes to the raise-request job picker', () => {
    mockUseMaterialRequests.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { items: [] },
    });
    render(<OfficerDashboardPage />);
    fireEvent.click(screen.getByTestId('mr-officer-create'));
    expect(mockNavigate).toHaveBeenCalledWith('/material-requests/jobs');
  });

  it('maps the "awaiting approval" chip to the awaitingApproval server param', () => {
    mockUseMaterialRequests.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { items: [] },
    });
    render(<OfficerDashboardPage />);
    fireEvent.click(screen.getByText('officer.quickFilters.awaitingApproval'));
    // Latest call carries the mapped param.
    const lastCall = mockUseMaterialRequests.mock.calls.slice(-1)[0]?.[0];
    expect(lastCall).toEqual({ awaitingApproval: true });
  });

  it('applies the client-side "due today" chip without a server param', () => {
    const todayItem = item({ id: 'today', neededByDate: NOW_ISO });
    const futureItem = item({ id: 'future', neededByDate: '2099-01-01T00:00:00.000Z' });
    mockUseMaterialRequests.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { items: [todayItem, futureItem] },
    });
    render(<OfficerDashboardPage />);
    fireEvent.click(screen.getByText('officer.quickFilters.dueToday'));

    // No server param for dueToday.
    const lastCall = mockUseMaterialRequests.mock.calls.slice(-1)[0]?.[0];
    expect(lastCall).toEqual({});
    // Only today's request remains in the table.
    expect(screen.getByTestId('mr-view-today')).toBeInTheDocument();
    expect(screen.queryByTestId('mr-view-future')).not.toBeInTheDocument();
  });

  it('clears the active chip when clicked again', () => {
    mockUseMaterialRequests.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { items: [] },
    });
    render(<OfficerDashboardPage />);
    const chip = screen.getByText('officer.quickFilters.approved');
    fireEvent.click(chip);
    expect(mockUseMaterialRequests.mock.calls.slice(-1)[0]?.[0]).toEqual({ approved: true });
    fireEvent.click(chip);
    expect(mockUseMaterialRequests.mock.calls.slice(-1)[0]?.[0]).toEqual({});
  });
});
