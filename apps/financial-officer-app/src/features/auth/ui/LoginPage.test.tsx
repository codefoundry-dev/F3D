import { render, screen, fireEvent } from '@testing-library/react';

const mockLoginMutation = vi.hoisted(() => ({
  mutate: vi.fn(),
  isError: false,
  isPending: false,
  error: null as unknown,
}));
vi.mock('../services/auth.service', () => ({
  useLogin: () => mockLoginMutation,
}));

vi.mock('@forethread/ui-components', () => ({
  LoginPage: ({ loginMutation }: any) => (
    <form
      data-testid="login-form"
      onSubmit={(e) => {
        e.preventDefault();
        loginMutation.mutate({ email: 'test@test.com', password: 'Test1234!' });
      }}
    >
      <span data-testid="is-error">{String(loginMutation.isError)}</span>
      <span data-testid="is-pending">{String(loginMutation.isPending)}</span>
      <button type="submit" data-testid="submit">
        Submit
      </button>
    </form>
  ),
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
}));

import LoginPage from './LoginPage';

describe('LoginPage', () => {
  afterEach(() => {
    mockLoginMutation.isError = false;
    mockLoginMutation.isPending = false;
    mockLoginMutation.error = null;
  });

  it('renders the login form', () => {
    render(<LoginPage />);
    expect(screen.getByTestId('login-form')).toBeInTheDocument();
  });

  it('passes loginMutation to shared LoginPage', () => {
    mockLoginMutation.isError = true;
    render(<LoginPage />);
    expect(screen.getByTestId('is-error')).toHaveTextContent('true');
  });

  it('passes isPending state to shared LoginPage', () => {
    mockLoginMutation.isPending = true;
    render(<LoginPage />);
    expect(screen.getByTestId('is-pending')).toHaveTextContent('true');
  });

  it('calls loginMutation.mutate when form is submitted', () => {
    render(<LoginPage />);
    const form = screen.getByTestId('login-form');
    fireEvent.submit(form);
    expect(mockLoginMutation.mutate).toHaveBeenCalledWith({
      email: 'test@test.com',
      password: 'Test1234!',
    });
  });
});
