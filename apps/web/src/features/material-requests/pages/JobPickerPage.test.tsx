import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockNavigate = vi.hoisted(() => vi.fn());
const mockUseProjects = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
vi.mock('@forethread/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@forethread/ui-components', () => ({ PageLoader: () => <div data-testid="loader" /> }));
vi.mock('@forethread/ui-components/assets/icons/chevron-right.svg?react', () => ({
  default: () => <svg />,
}));
vi.mock('@forethread/ui-components/assets/icons/package.svg?react', () => ({
  default: () => <svg />,
}));
vi.mock('@/app/route-config', () => ({
  ROUTES: { materialRequestJobOverview: '/material-requests/jobs/:projectId' },
}));
vi.mock('../components/MobileShell', () => ({
  MobileShell: ({ header, children }: { header: ReactNode; children: ReactNode }) => (
    <div>
      {header}
      {children}
    </div>
  ),
}));
vi.mock('../components/MobileHeader', () => ({
  MobileHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
vi.mock('../services/material-requests.service', () => ({
  useMrProjects: () => mockUseProjects(),
}));

import JobPickerPage from './JobPickerPage';

describe('JobPickerPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the loader while fetching', () => {
    mockUseProjects.mockReturnValue({ isLoading: true });
    render(<JobPickerPage />);
    expect(screen.getByTestId('loader')).toBeInTheDocument();
  });

  it('renders the empty state with no jobs', () => {
    mockUseProjects.mockReturnValue({ isLoading: false, data: [] });
    render(<JobPickerPage />);
    expect(screen.getByText('jobOverview.noJobs')).toBeInTheDocument();
  });

  it('lists assigned jobs and opens the overview on click', () => {
    mockUseProjects.mockReturnValue({
      isLoading: false,
      data: [
        { id: 'p1', name: 'JOB-2847', defaultDeliveryLocation: 'Dallas, TX' },
        { id: 'p2', name: 'JOB-3812', defaultDeliveryLocation: '' },
      ],
    });
    render(<JobPickerPage />);
    expect(screen.getByTestId('mr-job-list')).toBeInTheDocument();
    expect(screen.getByText('JOB-2847')).toBeInTheDocument();
    fireEvent.click(screen.getByText('JOB-2847'));
    expect(mockNavigate).toHaveBeenCalledWith('/material-requests/jobs/p1');
  });
});
