import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockNavigate = vi.fn();
const mockActivateMutate = vi.fn();
const mockRequestInvitationMutate = vi.fn();
let mockToken = 'valid-token';

let mockTokenQuery = {
  isLoading: false,
  isError: false,
  data: { valid: true, email: 'user@test.com' } as { valid: boolean; email?: string } | undefined,
};
let mockActivateMutation = {
  mutate: mockActivateMutate,
  isPending: false,
  isError: false,
  isSuccess: false,
};
let mockRequestInvitationMutation = {
  mutate: mockRequestInvitationMutate,
  isPending: false,
  isSuccess: false,
};

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/shared-types/client', () => ({
  passwordFormSchema: { parse: vi.fn() },
}));

vi.mock('@forethread/ui-components', () => ({
  AuthLayout: ({
    children,
    title,
    description,
  }: {
    children: React.ReactNode;
    title: string;
    description: string;
  }) => (
    <div data-testid="auth-layout">
      <span data-testid="auth-title">{title}</span>
      <span data-testid="auth-description">{description}</span>
      {children}
    </div>
  ),
  Button: ({ children, onClick, disabled, isLoading }: Record<string, unknown>) => (
    <button data-testid="button" onClick={onClick as () => void} disabled={disabled as boolean}>
      {isLoading ? 'loading...' : (children as React.ReactNode)}
    </button>
  ),
  ContactSupportLink: ({ label }: { label: string }) => (
    <button data-testid="contact-support">{label}</button>
  ),
  IconBadge: ({ icon }: { icon: React.ReactNode }) => <div data-testid="icon-badge">{icon}</div>,
  PageLoader: () => <div data-testid="page-loader">Loading...</div>,
  ResetPasswordForm: (props: Record<string, unknown>) => (
    <div data-testid="reset-password-form">
      <span data-testid="form-title">{props.title as string}</span>
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
  Text: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
}));

vi.mock('@forethread/ui-components/assets/icons/checkcircle-icon.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/clock-icon.svg?react', () => ({
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
          return cb({ newPassword: 'Password1!', confirmPassword: 'Password1!' });
        },
    ),
    watch: (field: string) => {
      if (field === 'newPassword') return 'Password1!';
      if (field === 'confirmPassword') return 'Password1!';
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
  useActivateAccount: () => mockActivateMutation,
  useValidateActivationToken: () => mockTokenQuery,
  useRequestNewInvitation: () => mockRequestInvitationMutation,
}));

import WarehouseOfficerActivateAccountPage from './WarehouseOfficerActivateAccountPage';

describe('WarehouseOfficerActivateAccountPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockToken = 'valid-token';
    mockTokenQuery = {
      isLoading: false,
      isError: false,
      data: { valid: true, email: 'user@test.com' },
    };
    mockActivateMutation = {
      mutate: mockActivateMutate,
      isPending: false,
      isError: false,
      isSuccess: false,
    };
    mockRequestInvitationMutation = {
      mutate: mockRequestInvitationMutate,
      isPending: false,
      isSuccess: false,
    };
  });

  it('shows missing token message when no token in URL', () => {
    mockToken = '';
    render(<WarehouseOfficerActivateAccountPage />);
    expect(screen.getByText('activateLinkMissing')).toBeInTheDocument();
  });

  it('shows page loader when token is loading', () => {
    mockTokenQuery.isLoading = true;
    render(<WarehouseOfficerActivateAccountPage />);
    expect(screen.getByTestId('page-loader')).toBeInTheDocument();
  });

  it('shows expired invitation when token is invalid', () => {
    mockTokenQuery.data = { valid: false, email: 'user@test.com' };
    render(<WarehouseOfficerActivateAccountPage />);
    expect(screen.getByTestId('auth-title')).toHaveTextContent('invitationExpiredTitle');
  });

  it('shows expired invitation when token query errors', () => {
    mockTokenQuery.isError = true;
    mockTokenQuery.data = undefined;
    render(<WarehouseOfficerActivateAccountPage />);
    expect(screen.getByTestId('auth-title')).toHaveTextContent('invitationExpiredTitle');
  });

  it('request new invitation button calls mutate with email', () => {
    mockTokenQuery.data = { valid: false, email: 'user@test.com' };
    render(<WarehouseOfficerActivateAccountPage />);
    fireEvent.click(screen.getByTestId('button'));
    expect(mockRequestInvitationMutate).toHaveBeenCalledWith('user@test.com');
  });

  it('shows reset password form when token is valid', () => {
    render(<WarehouseOfficerActivateAccountPage />);
    expect(screen.getByTestId('reset-password-form')).toBeInTheDocument();
    expect(screen.getByTestId('form-title')).toHaveTextContent('setPassword');
  });

  it('calls activate mutate on submit', () => {
    render(<WarehouseOfficerActivateAccountPage />);
    fireEvent.click(screen.getByTestId('submit'));
    expect(mockActivateMutate).toHaveBeenCalledWith({
      token: 'valid-token',
      password: 'Password1!',
    });
  });

  it('navigates to login on redirect', () => {
    render(<WarehouseOfficerActivateAccountPage />);
    fireEvent.click(screen.getByTestId('redirect-login'));
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('shows error content when activate mutation fails', () => {
    mockActivateMutation.isError = true;
    render(<WarehouseOfficerActivateAccountPage />);
    expect(screen.getByTestId('error-content')).toBeInTheDocument();
  });

  it('passes isSuccess state to form', () => {
    mockActivateMutation.isSuccess = true;
    render(<WarehouseOfficerActivateAccountPage />);
    expect(screen.getByTestId('is-success')).toHaveTextContent('true');
  });
});
