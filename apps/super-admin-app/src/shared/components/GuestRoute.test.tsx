import { render, screen } from '@testing-library/react';

vi.mock('@/features/auth/services/auth.service', () => ({
  useCheckAuth: vi.fn(),
}));

const mockIsAuthenticated = vi.fn();
const mockIsAuthLoading = vi.fn().mockReturnValue(false);
vi.mock('@/features/auth/state/auth.store', () => ({
  useAuthStore: (selector: (s: any) => any) =>
    selector({ isAuthenticated: mockIsAuthenticated(), isAuthLoading: mockIsAuthLoading() }),
}));

vi.mock('@forethread/ui-components', () => ({
  GuestRoute: ({
    isAuthenticated,
    isAuthLoading,
  }: {
    isAuthenticated: boolean;
    isAuthLoading?: boolean;
  }) =>
    isAuthLoading ? (
      <div data-testid="loading">Loading</div>
    ) : isAuthenticated ? (
      <div data-testid="navigate">Home</div>
    ) : (
      <div data-testid="outlet">Guest</div>
    ),
}));

import { GuestRoute } from './GuestRoute';

describe('GuestRoute', () => {
  it('renders outlet for unauthenticated users', () => {
    mockIsAuthenticated.mockReturnValue(false);
    render(<GuestRoute />);
    expect(screen.getByTestId('outlet')).toBeInTheDocument();
  });

  it('redirects to home when authenticated', () => {
    mockIsAuthenticated.mockReturnValue(true);
    render(<GuestRoute />);
    expect(screen.getByTestId('navigate')).toBeInTheDocument();
  });

  it('renders nothing while auth is loading', () => {
    mockIsAuthenticated.mockReturnValue(false);
    mockIsAuthLoading.mockReturnValue(true);
    render(<GuestRoute />);
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });
});
