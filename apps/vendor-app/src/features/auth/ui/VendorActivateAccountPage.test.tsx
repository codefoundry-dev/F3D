import { render, screen, fireEvent } from '@testing-library/react';

const mockTokenQuery = vi.hoisted(() => ({
  value: {
    isLoading: false,
    isError: false,
    data: { valid: true, email: 'test@test.com' } as { valid: boolean; email: string } | null,
  },
}));

const mockActivateMutation = vi.hoisted(() => ({
  value: {
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    isSuccess: false,
  },
}));

const mockRequestInvitationMutation = vi.hoisted(() => ({
  value: {
    mutate: vi.fn(),
    isPending: false,
    isSuccess: false,
  },
}));

const mockSearchParams = vi.hoisted(() => ({
  value: new URLSearchParams('token=test-token'),
}));

const mockNavigate = vi.fn();

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [mockSearchParams.value],
  useNavigate: () => mockNavigate,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock('@hookform/resolvers/zod', () => ({
  zodResolver: () => () => ({ values: {}, errors: {} }),
}));

vi.mock('../services/auth.service', () => ({
  useActivateAccount: () => mockActivateMutation.value,
  useValidateActivationToken: () => mockTokenQuery.value,
  useRequestNewInvitation: () => mockRequestInvitationMutation.value,
}));

vi.mock('@forethread/ui-components', () => ({
  AuthLayout: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <div data-testid="auth-layout">
      <span>{title}</span>
      {children}
    </div>
  ),
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  ContactSupportLink: ({ label }: { label: string }) => <span>{label}</span>,
  IconBadge: ({ icon }: { icon: React.ReactNode }) => <span>{icon}</span>,
  PageLoader: () => <div data-testid="page-loader">Loading...</div>,
  ResetPasswordForm: (props: Record<string, unknown>) => {
    const onSubmit = props.onSubmit as ((e: React.FormEvent) => void) | undefined;
    const onRedirectToLogin = props.onRedirectToLogin as (() => void) | undefined;
    return (
      <div data-testid="reset-password-form">
        <span>{props.title as string}</span>
        <span>{props.submitLabel as string}</span>
        {Boolean(props.errorContent) && (
          <span data-testid="error">{String(props.errorContent)}</span>
        )}
        {onSubmit && (
          <button data-testid="submit" onClick={(e) => onSubmit(e as unknown as React.FormEvent)}>
            Submit
          </button>
        )}
        {onRedirectToLogin && (
          <button data-testid="redirect" onClick={onRedirectToLogin}>
            Redirect
          </button>
        )}
      </div>
    );
  },
  Text: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('@forethread/ui-components/assets/icons/checkcircle-icon.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/clock-icon.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/eye-closed.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/eye-opened.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/info.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/key-icon.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/lock-simple.svg?react', () => ({
  default: () => <span />,
}));

vi.mock('@forethread/shared-types/client', () => ({
  passwordFormSchema: { parse: vi.fn() },
}));

import VendorActivateAccountPage from './VendorActivateAccountPage';

describe('VendorActivateAccountPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.value = new URLSearchParams('token=test-token');
    mockTokenQuery.value = {
      isLoading: false,
      isError: false,
      data: { valid: true, email: 'test@test.com' },
    };
    mockActivateMutation.value = {
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      isSuccess: false,
    };
    mockRequestInvitationMutation.value = {
      mutate: vi.fn(),
      isPending: false,
      isSuccess: false,
    };
  });

  it('shows missing token message when no token', () => {
    mockSearchParams.value = new URLSearchParams('');
    render(<VendorActivateAccountPage />);
    expect(screen.getByText('activateLinkMissing')).toBeInTheDocument();
  });

  it('shows page loader while loading', () => {
    mockTokenQuery.value = { ...mockTokenQuery.value, isLoading: true };
    render(<VendorActivateAccountPage />);
    expect(screen.getByTestId('page-loader')).toBeInTheDocument();
  });

  it('shows expired token view when token is invalid', () => {
    mockTokenQuery.value = {
      isLoading: false,
      isError: false,
      data: { valid: false, email: 'test@test.com' },
    };
    render(<VendorActivateAccountPage />);
    expect(screen.getByText('invitationExpiredTitle')).toBeInTheDocument();
    expect(screen.getByText('requestNewLink')).toBeInTheDocument();
  });

  it('requests new invitation when button clicked', () => {
    mockTokenQuery.value = {
      isLoading: false,
      isError: false,
      data: { valid: false, email: 'test@test.com' },
    };
    render(<VendorActivateAccountPage />);
    fireEvent.click(screen.getByText('requestNewLink'));
    expect(mockRequestInvitationMutation.value.mutate).toHaveBeenCalledWith('test@test.com');
  });

  it('shows expired token view on API error', () => {
    mockTokenQuery.value = {
      isLoading: false,
      isError: true,
      data: null,
    };
    render(<VendorActivateAccountPage />);
    expect(screen.getByText('invitationExpiredTitle')).toBeInTheDocument();
  });

  it('shows password form when token is valid', () => {
    render(<VendorActivateAccountPage />);
    expect(screen.getByTestId('reset-password-form')).toBeInTheDocument();
    expect(screen.getByText('setPassword')).toBeInTheDocument();
    expect(screen.getByText('activateAccount')).toBeInTheDocument();
  });

  it('invokes submit handler', () => {
    render(<VendorActivateAccountPage />);
    fireEvent.click(screen.getByTestId('submit'));
  });

  it('redirects to login on success', () => {
    render(<VendorActivateAccountPage />);
    fireEvent.click(screen.getByTestId('redirect'));
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('shows error content when activate mutation has error', () => {
    mockActivateMutation.value = {
      mutate: vi.fn(),
      isPending: false,
      isError: true,
      isSuccess: false,
    };
    render(<VendorActivateAccountPage />);
    expect(screen.getByTestId('error')).toBeInTheDocument();
  });
});
