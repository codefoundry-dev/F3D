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
  PrivateRoute: ({
    isAuthenticated,
    isAuthLoading,
  }: {
    isAuthenticated: boolean;
    isAuthLoading?: boolean;
  }) =>
    isAuthLoading ? (
      <div data-testid="loading">Loading</div>
    ) : isAuthenticated ? (
      <div data-testid="outlet">Protected</div>
    ) : (
      <div data-testid="navigate">/login</div>
    ),
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
}));

import { PrivateRoute } from './PrivateRoute';

describe('PrivateRoute', () => {
  it('redirects to login when not authenticated', () => {
    mockIsAuthenticated.mockReturnValue(false);
    render(<PrivateRoute />);
    expect(screen.getByTestId('navigate')).toBeInTheDocument();
  });

  it('renders outlet when authenticated', () => {
    mockIsAuthenticated.mockReturnValue(true);
    render(<PrivateRoute />);
    expect(screen.getByTestId('outlet')).toBeInTheDocument();
  });
});
