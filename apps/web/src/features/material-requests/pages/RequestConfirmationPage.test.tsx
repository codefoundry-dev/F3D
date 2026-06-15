import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockNavigate = vi.hoisted(() => vi.fn());
const mockLocationState = vi.hoisted(() => ({ current: null as unknown }));
const mockUseMaterialRequest = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ state: mockLocationState.current }),
  useParams: () => ({ id: 'mr-1' }),
}));
vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
  }),
}));
vi.mock('@forethread/ui-components', () => ({ PageLoader: () => <div data-testid="loader" /> }));
vi.mock('@forethread/ui-components/assets/icons/checkcircle-icon.svg?react', () => ({
  default: () => <svg />,
}));
vi.mock('@forethread/ui-components/assets/icons/flag.svg?react', () => ({
  default: () => <svg />,
}));
vi.mock('@forethread/ui-components/assets/icons/package.svg?react', () => ({
  default: () => <svg />,
}));
vi.mock('@forethread/ui-components/assets/icons/projects.svg?react', () => ({
  default: () => <svg />,
}));
vi.mock('@/app/route-config', () => ({ ROUTES: { materialRequests: '/material-requests' } }));
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
  MobileHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
vi.mock('../components/MobileButtons', () => ({
  PrimaryButton: ({
    children,
    onClick,
    ...rest
  }: {
    children: ReactNode;
    onClick?: () => void;
  }) => {
    const { leading: _l, withArrow: _w, ...domProps } = rest as Record<string, unknown>;
    return (
      <button type="button" onClick={onClick} {...(domProps as object)}>
        {children}
      </button>
    );
  },
  SecondaryButton: ({
    children,
    onClick,
    ...rest
  }: {
    children: ReactNode;
    onClick?: () => void;
  }) => (
    <button type="button" onClick={onClick} {...rest}>
      {children}
    </button>
  ),
}));
vi.mock('../services/material-requests.service', () => ({
  useMaterialRequest: () => mockUseMaterialRequest(),
}));

import RequestConfirmationPage from './RequestConfirmationPage';

const MR = {
  id: 'mr-1',
  mrNumber: 'MR-1001',
  status: 'SUBMITTED',
  priority: 'HIGH',
  project: { id: 'p1', name: 'Downtown Office' },
  lineItems: [{ id: 'l1' }, { id: 'l2' }],
};

describe('RequestConfirmationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocationState.current = null;
    mockUseMaterialRequest.mockReturnValue({ isLoading: false, data: undefined });
  });

  it('renders the MR number as the reference id from router state', () => {
    mockLocationState.current = { mr: MR };
    render(<RequestConfirmationPage />);
    expect(screen.getByTestId('mr-reference-id').textContent).toBe('MR-1001');
    expect(screen.getByText('Downtown Office')).toBeInTheDocument();
  });

  it('falls back to fetching by id when there is no router state', () => {
    mockUseMaterialRequest.mockReturnValue({ isLoading: false, data: MR });
    render(<RequestConfirmationPage />);
    expect(screen.getByTestId('mr-reference-id').textContent).toBe('MR-1001');
  });

  it('shows the loader while fetching with no state', () => {
    mockUseMaterialRequest.mockReturnValue({ isLoading: true, data: undefined });
    render(<RequestConfirmationPage />);
    expect(screen.getByTestId('loader')).toBeInTheDocument();
  });

  it('navigates to My Requests from Done and View My Requests', () => {
    mockLocationState.current = { mr: MR };
    render(<RequestConfirmationPage />);
    fireEvent.click(screen.getByTestId('mr-confirm-done'));
    fireEvent.click(screen.getByTestId('mr-confirm-view'));
    expect(mockNavigate).toHaveBeenNthCalledWith(1, '/material-requests');
    expect(mockNavigate).toHaveBeenNthCalledWith(2, '/material-requests');
  });
});
