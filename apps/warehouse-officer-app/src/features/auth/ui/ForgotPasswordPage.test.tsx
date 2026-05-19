import { render, screen, fireEvent } from '@testing-library/react';

const mockForgotMutation = vi.hoisted(() => ({
  mutate: vi.fn(),
  isPending: false,
  isSuccess: false,
}));
vi.mock('../services/auth.service', () => ({
  useForgotPassword: () => mockForgotMutation,
}));

vi.mock('@forethread/ui-components', () => ({
  ForgotPasswordPage: ({ forgotMutation }: any) => (
    <div data-testid="forgot-page">
      <span data-testid="is-pending">{String(forgotMutation.isPending)}</span>
      <span data-testid="is-success">{String(forgotMutation.isSuccess)}</span>
      <button
        data-testid="submit"
        onClick={() => forgotMutation.mutate({ email: 'test@test.com' })}
      >
        Submit
      </button>
    </div>
  ),
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
}));

import ForgotPasswordPage from './ForgotPasswordPage';

describe('ForgotPasswordPage', () => {
  afterEach(() => {
    mockForgotMutation.isPending = false;
    mockForgotMutation.isSuccess = false;
    vi.clearAllMocks();
  });

  it('renders the forgot password page', () => {
    render(<ForgotPasswordPage />);
    expect(screen.getByTestId('forgot-page')).toBeInTheDocument();
  });

  it('passes isPending state to shared ForgotPasswordPage', () => {
    mockForgotMutation.isPending = true;
    render(<ForgotPasswordPage />);
    expect(screen.getByTestId('is-pending')).toHaveTextContent('true');
  });

  it('passes isSuccess state to shared ForgotPasswordPage', () => {
    mockForgotMutation.isSuccess = true;
    render(<ForgotPasswordPage />);
    expect(screen.getByTestId('is-success')).toHaveTextContent('true');
  });

  it('calls forgotMutation.mutate when form is submitted', () => {
    render(<ForgotPasswordPage />);
    fireEvent.click(screen.getByTestId('submit'));
    expect(mockForgotMutation.mutate).toHaveBeenCalledWith({ email: 'test@test.com' });
  });
});
