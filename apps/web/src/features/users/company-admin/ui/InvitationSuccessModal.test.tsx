import { render, screen } from '@testing-library/react';

const mockUsersStore = vi.hoisted(() => vi.fn());

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: any) => {
      // Resolve the email-sent copy with the interpolated email so the
      // component can split + bold the address (mirrors real i18n behaviour).
      if (key === 'invitationSuccess.emailSent' && opts?.email) {
        return `The user ${opts.email} will receive an activation email.`;
      }
      if (key === 'invitationSuccess.redirecting' && opts?.seconds !== undefined) {
        return `Redirecting in ${opts.seconds} seconds`;
      }
      return key;
    },
  }),
}));

vi.mock('@forethread/ui-components', () => ({
  GridModal: ({ icon, title, description, children, actions, onSubmit }: any) =>
    onSubmit ? (
      <form data-testid="modal" onSubmit={onSubmit}>
        {icon}
        <h2>{title}</h2>
        <p>{description}</p>
        {children}
        {actions}
      </form>
    ) : (
      <div data-testid="modal">
        {icon}
        <h2>{title}</h2>
        <p>{description}</p>
        {children}
        {actions}
      </div>
    ),
  Modal: ({ children, onClose }: any) => (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div data-testid="modal" onClick={onClose}>
      {children}
    </div>
  ),
  ModalBody: ({ children }: any) => <div>{children}</div>,
  ModalCloseButton: ({ onClose }: any) => (
    <button data-testid="close" onClick={onClose} type="button">
      close
    </button>
  ),
  IconBadge: ({ icon }: any) => <div data-testid="icon-badge">{icon}</div>,
  Button: ({ children, onClick }: any) => (
    <button data-testid="btn" onClick={onClick} type="button">
      {children}
    </button>
  ),
}));

vi.mock('@forethread/ui-components/assets/icons/checkcircle-icon.svg?react', () => ({
  default: () => <div data-testid="check-icon" />,
}));

vi.mock('../state/users.store', () => ({
  useUsersStore: mockUsersStore,
}));

import { InvitationSuccessModal } from './InvitationSuccessModal';

describe('InvitationSuccessModal', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUsersStore.mockReturnValue('user@example.com');
  });

  it('renders the modal', () => {
    render(<InvitationSuccessModal onClose={mockOnClose} />);
    expect(screen.getByTestId('modal')).toBeInTheDocument();
  });

  it('renders the title', () => {
    render(<InvitationSuccessModal onClose={mockOnClose} />);
    expect(screen.getByText('invitationSuccess.title')).toBeInTheDocument();
  });

  it('renders the subtitle', () => {
    render(<InvitationSuccessModal onClose={mockOnClose} />);
    expect(screen.getByText('invitationSuccess.subtitle')).toBeInTheDocument();
  });

  it('renders link expiry note', () => {
    render(<InvitationSuccessModal onClose={mockOnClose} />);
    expect(screen.getByText('invitationSuccess.linkExpiry')).toBeInTheDocument();
  });

  it('renders back to users button', () => {
    render(<InvitationSuccessModal onClose={mockOnClose} />);
    expect(screen.getByText('invitationSuccess.backToUsers')).toBeInTheDocument();
  });

  it('renders the created user email in bold', () => {
    render(<InvitationSuccessModal onClose={mockOnClose} />);
    const strong = screen.getByText('user@example.com');
    expect(strong.tagName).toBe('STRONG');
  });

  it('shows the redirect countdown', () => {
    render(<InvitationSuccessModal onClose={mockOnClose} />);
    expect(screen.getByText('Redirecting in 3 seconds')).toBeInTheDocument();
  });
});
