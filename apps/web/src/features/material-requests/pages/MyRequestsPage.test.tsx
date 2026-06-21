import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockNavigate = vi.hoisted(() => vi.fn());
const mockUseRequests = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts && 'count' in opts ? `${key}:${String(opts.count)}` : key,
  }),
}));
vi.mock('@forethread/rfq-shared', () => ({
  usePageTitleStore: (selector: (s: { setTitle: () => void }) => unknown) =>
    selector({ setTitle: vi.fn() }),
}));
vi.mock('@forethread/ui-components', () => ({
  PageLoader: () => <div data-testid="loader" />,
  formatDate: (d: string) => d,
}));
vi.mock('@forethread/ui-components/assets/icons/chevron-right.svg?react', () => ({
  default: () => <svg />,
}));
vi.mock('@forethread/ui-components/assets/icons/package.svg?react', () => ({
  default: () => <svg />,
}));
vi.mock('@forethread/ui-components/assets/icons/plus.svg?react', () => ({
  default: () => <svg />,
}));
vi.mock('@/app/route-config', () => ({
  ROUTES: { materialRequestJobs: '/material-requests/jobs' },
}));
vi.mock('../components/MobileShell', () => ({
  MobileShell: ({
    header,
    footer,
    children,
  }: {
    header: ReactNode;
    footer: ReactNode;
    children: ReactNode;
  }) => (
    <div>
      {header}
      {children}
      {footer}
    </div>
  ),
}));
vi.mock('../components/MobileHeader', () => ({
  MobileHeader: ({ title, trailing }: { title: string; trailing?: ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {trailing}
    </div>
  ),
}));
vi.mock('../components/MobileButtons', () => ({
  PrimaryButton: ({
    children,
    onClick,
    'data-testid': testId,
  }: {
    children: ReactNode;
    onClick?: () => void;
    'data-testid'?: string;
  }) => (
    <button type="button" data-testid={testId} onClick={onClick}>
      {children}
    </button>
  ),
}));
vi.mock('../officer/components/MrStatusBadge', () => ({
  MrStatusBadge: ({ status }: { status: string }) => <span>status.{status}</span>,
  MrPriorityBadge: ({ priority }: { priority: string }) => (
    <span data-testid="priority-badge">priority.{priority}</span>
  ),
}));
vi.mock('../services/material-requests.service', () => ({
  useMaterialRequests: () => mockUseRequests(),
}));

import MyRequestsPage from './MyRequestsPage';

describe('MyRequestsPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the loader while fetching', () => {
    mockUseRequests.mockReturnValue({ isLoading: true });
    render(<MyRequestsPage />);
    expect(screen.getByTestId('loader')).toBeInTheDocument();
  });

  it('renders the empty state when there are no requests', () => {
    mockUseRequests.mockReturnValue({ isLoading: false, isError: false, data: { items: [] } });
    render(<MyRequestsPage />);
    expect(screen.getByText('myRequests.empty')).toBeInTheDocument();
  });

  it('lists the foreman requests with number, project and status', () => {
    mockUseRequests.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        items: [
          {
            id: 'mr-1',
            mrNumber: 'MR-1001',
            status: 'SUBMITTED',
            priority: 'HIGH',
            project: { id: 'p1', name: 'Downtown Office' },
            requestedBy: { id: 'u1', name: 'Joe' },
            lineItemCount: 3,
            neededByDate: '2026-07-01',
            createdAt: '2026-06-15',
          },
        ],
      },
    });
    render(<MyRequestsPage />);
    expect(screen.getByTestId('mr-requests-list')).toBeInTheDocument();
    expect(screen.getByText('MR-1001')).toBeInTheDocument();
    expect(screen.getByText('Downtown Office')).toBeInTheDocument();
    expect(screen.getByText('status.SUBMITTED')).toBeInTheDocument();
  });

  it('shows the error state on failure', () => {
    mockUseRequests.mockReturnValue({ isLoading: false, isError: true, data: undefined });
    render(<MyRequestsPage />);
    expect(screen.getByText('myRequests.loadFailed')).toBeInTheDocument();
  });

  it('navigates to the job picker from the New Request button', () => {
    mockUseRequests.mockReturnValue({ isLoading: false, isError: false, data: { items: [] } });
    render(<MyRequestsPage />);
    fireEvent.click(screen.getByTestId('mr-new-request'));
    expect(mockNavigate).toHaveBeenCalledWith('/material-requests/jobs');
  });
});
