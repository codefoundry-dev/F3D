import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockNavigate = vi.fn();
const mockMutate = vi.fn();
let mockToken = 'reset-token';
let mockResetMutation = {
  mutate: mockMutate,
  isPending: false,
  isError: false,
  isSuccess: false,
};

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/shared-types/client', () => ({
  passwordFormSchema: { parse: vi.fn() },
}));

vi.mock('@forethread/ui-components', () => ({
  ResetPasswordForm: (props: Record<string, unknown>) => (
    <div data-testid="reset-password-form">
      <span data-testid="title">{props.title as string}</span>
      <span data-testid="is-pending">{String(props.isPending)}</span>
      <span data-testid="is-valid">{String(props.isValid)}</span>
      <span data-testid="is-success">{String(props.isSuccess)}</span>
      {props.errorContent !== undefined && props.errorContent !== null && (
        <span data-testid="error-content">{props.errorContent as React.ReactNode}</span>
      )}
      <button
        data-testid="submit"
        onClick={(e) => (props.onSubmit as (e: React.MouseEvent) => void)(e)}
      >
        {props.submitLabel as string}
      </button>
      <button data-testid="redirect-login" onClick={props.onRedirectToLogin as () => void}>
        redirect
      </button>
    </div>
  ),
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
}));

vi.mock('@forethread/ui-components/assets/icons/checkcircle-icon.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/eye-closed.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/eye-opened.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/info.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/key-icon.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/lock-simple.svg?react', () => ({
  default: () => <div />,
}));

vi.mock('@hookform/resolvers/zod', () => ({
  zodResolver: () => vi.fn(),
}));

vi.mock('react-hook-form', () => ({
  useForm: () => ({
    register: vi.fn((name: string) => ({ name })),
    handleSubmit: vi.fn(
      (cb: (data: { newPassword: string; confirmPassword: string }) => void) =>
        (e?: { preventDefault?: () => void }) => {
          e?.preventDefault?.();
          return cb({ newPassword: 'NewPass1!', confirmPassword: 'NewPass1!' });
        },
    ),
    watch: (field: string) => {
      if (field === 'newPassword') return 'NewPass1!';
      if (field === 'confirmPassword') return 'NewPass1!';
      return '';
    },
    formState: { isValid: true },
  }),
}));

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [new URLSearchParams(`token=${mockToken}`)],
  useNavigate: () => mockNavigate,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to} data-testid="link">
      {children}
    </a>
  ),
}));

vi.mock('../services/auth.service', () => ({
  useResetPassword: () => mockResetMutation,
}));

import WarehouseOfficerResetPasswordPage from './WarehouseOfficerResetPasswordPage';

describe('WarehouseOfficerResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockToken = 'reset-token';
    mockResetMutation = {
      mutate: mockMutate,
      isPending: false,
      isError: false,
      isSuccess: false,
    };
  });

  it('shows missing token message when no token', () => {
    mockToken = '';
    render(<WarehouseOfficerResetPasswordPage />);
    expect(screen.getByText('resetLinkMissing')).toBeInTheDocument();
    expect(screen.getByText('requestNewLink')).toBeInTheDocument();
  });

  it('renders reset password form when token exists', () => {
    render(<WarehouseOfficerResetPasswordPage />);
    expect(screen.getByTestId('reset-password-form')).toBeInTheDocument();
    expect(screen.getByTestId('title')).toHaveTextContent('setNewPasswordTitle');
  });

  it('calls mutate on submit with token and new password', () => {
    render(<WarehouseOfficerResetPasswordPage />);
    fireEvent.click(screen.getByTestId('submit'));
    expect(mockMutate).toHaveBeenCalledWith({ token: 'reset-token', newPassword: 'NewPass1!' });
  });

  it('shows success state', () => {
    mockResetMutation.isSuccess = true;
    render(<WarehouseOfficerResetPasswordPage />);
    expect(screen.getByTestId('is-success')).toHaveTextContent('true');
  });

  it('shows error content when reset fails', () => {
    mockResetMutation.isError = true;
    render(<WarehouseOfficerResetPasswordPage />);
    expect(screen.getByTestId('error-content')).toBeInTheDocument();
  });

  it('passes pending state', () => {
    mockResetMutation.isPending = true;
    render(<WarehouseOfficerResetPasswordPage />);
    expect(screen.getByTestId('is-pending')).toHaveTextContent('true');
  });

  it('navigates to login on redirect', () => {
    render(<WarehouseOfficerResetPasswordPage />);
    fireEvent.click(screen.getByTestId('redirect-login'));
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('shows no error content when no error and no mismatch', () => {
    render(<WarehouseOfficerResetPasswordPage />);
    expect(screen.queryByTestId('error-content')).not.toBeInTheDocument();
  });
});
