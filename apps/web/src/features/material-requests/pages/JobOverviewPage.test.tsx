import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockNavigate = vi.hoisted(() => vi.fn());
const mockUseProjectDetail = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ projectId: 'proj-1' }),
}));
vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts && 'code' in opts ? `${key}:${String(opts.code)}` : key,
  }),
}));
vi.mock('@forethread/rfq-shared', () => ({
  usePageTitleStore: (selector: (s: { setTitle: () => void }) => unknown) =>
    selector({ setTitle: vi.fn() }),
}));
vi.mock('@forethread/ui-components', () => ({
  PageLoader: () => <div data-testid="loader" />,
  formatDate: (d: string) => d,
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock('@forethread/ui-components/assets/icons/date.svg?react', () => ({
  default: () => <svg />,
}));
vi.mock('@forethread/ui-components/assets/icons/location.svg?react', () => ({
  default: () => <svg />,
}));
vi.mock('@forethread/ui-components/assets/icons/plus.svg?react', () => ({
  default: () => <svg />,
}));
vi.mock('@forethread/ui-components/assets/icons/user-outline.svg?react', () => ({
  default: () => <svg />,
}));
vi.mock('@forethread/ui-components/assets/icons/users-group.svg?react', () => ({
  default: () => <svg />,
}));
vi.mock('@/app/route-config', () => ({
  ROUTES: {
    materialRequestJobs: '/material-requests/jobs',
    materialRequestNew: '/material-requests/jobs/:projectId/new',
  },
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
  MobileHeader: ({
    title,
    subline,
    trailing,
  }: {
    title: string;
    subline?: ReactNode;
    trailing?: ReactNode;
  }) => (
    <div>
      <h1>{title}</h1>
      {subline}
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
    leading?: ReactNode;
    'data-testid'?: string;
  }) => (
    <button type="button" data-testid={testId} onClick={onClick}>
      {children}
    </button>
  ),
}));
vi.mock('../components/ProcurementStatusBar', () => ({
  ProcurementStatusBar: ({ stages }: { stages: Array<{ key: string; done: boolean }> }) => (
    <div data-testid="status-bar" data-done={stages.filter((s) => s.done).length} />
  ),
}));
vi.mock('../services/material-requests.service', () => ({
  useMrProjectDetail: () => mockUseProjectDetail(),
}));

import JobOverviewPage from './JobOverviewPage';

const PROJECT = {
  id: 'proj-1',
  name: 'JOB-2847',
  description: 'Phase 2',
  status: 'ACTIVE',
  locations: [
    { id: 'loc-1', type: 'DELIVERY', address: '1250 Commerce St', label: null, isDefault: true },
  ],
  assignedUsers: [{ id: 'u1' }, { id: 'u2' }],
  pointOfContact: { id: 'pm', name: 'Sarah Mitchell' },
  startDate: '2026-01-15',
  expectedEndDate: '2026-06-30',
  rfqCount: 2,
  poCount: 1,
};

describe('JobOverviewPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the loader while fetching', () => {
    mockUseProjectDetail.mockReturnValue({ isLoading: true });
    render(<JobOverviewPage />);
    expect(screen.getByTestId('loader')).toBeInTheDocument();
  });

  it('shows the error state when the project fails to load', () => {
    mockUseProjectDetail.mockReturnValue({ isLoading: false, isError: true, data: undefined });
    render(<JobOverviewPage />);
    expect(screen.getByText('jobOverview.loadFailed')).toBeInTheDocument();
  });

  it('renders the job header, manager, dates and a status bar with the early stages done', () => {
    mockUseProjectDetail.mockReturnValue({ isLoading: false, isError: false, data: PROJECT });
    render(<JobOverviewPage />);
    expect(screen.getAllByText('JOB-2847').length).toBeGreaterThan(0);
    expect(screen.getByText('Sarah Mitchell')).toBeInTheDocument();
    expect(screen.getByText('1250 Commerce St')).toBeInTheDocument();
    // rfqCount > 0 and poCount > 0 → 3 stages lit (RFQ Created, RFQ Approved, PO Issued).
    expect(screen.getByTestId('status-bar').getAttribute('data-done')).toBe('3');
  });

  it('navigates to the wizard when Request Materials is tapped', () => {
    mockUseProjectDetail.mockReturnValue({ isLoading: false, isError: false, data: PROJECT });
    render(<JobOverviewPage />);
    fireEvent.click(screen.getByTestId('mr-request-materials'));
    expect(mockNavigate).toHaveBeenCalledWith('/material-requests/jobs/proj-1/new');
  });
});
