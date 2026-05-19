import { render, screen } from '@testing-library/react';

const mockUsersStore = vi.hoisted(() => vi.fn());

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: any) => (opts ? `${key}:${JSON.stringify(opts)}` : key),
  }),
}));

vi.mock('@forethread/ui-components', () => ({
  StatusSuccessModal: ({
    title,
    subtitle,
    description,
    note,
    buttonLabel,
    redirectLabel,
    onClose,
  }: any) => (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div data-testid="modal" onClick={onClose}>
      <span>{title}</span>
      <span>{subtitle}</span>
      <div>{description}</div>
      {note && <span>{note}</span>}
      <button data-testid="btn" onClick={onClose}>
        {buttonLabel}
      </button>
      <span>{redirectLabel(3)}</span>
    </div>
  ),
}));

vi.mock('@forethread/ui-components/assets/icons/checkcircle-icon.svg?react', () => ({
  default: () => <div />,
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
});
