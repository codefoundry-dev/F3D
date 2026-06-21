import { render, screen, fireEvent, act } from '@testing-library/react';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/ui-components', () => ({
  Button: ({ children, ...p }: any) => <button {...p}>{children}</button>,
  IconBadge: () => <div data-testid="icon-badge" />,
  ModalGridHeader: ({ title, subtitle }: any) => (
    <div data-testid="modal-grid-header">
      <div>{title}</div>
      {subtitle ? <div>{subtitle}</div> : null}
    </div>
  ),
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
}));

vi.mock('@forethread/ui-components/assets/icons/checkcircle-icon.svg?react', () => ({
  default: (p: any) => <svg data-testid="icon-check" {...p} />,
}));

import { InvitationSuccessStep } from './InvitationSuccessStep';

describe('InvitationSuccessStep', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the success title', () => {
    render(<InvitationSuccessStep email="alice@example.com" onClose={vi.fn()} />);
    expect(screen.getByText('invitationSuccess.title')).toBeInTheDocument();
  });

  it('renders the email sent message', () => {
    render(<InvitationSuccessStep email="alice@example.com" onClose={vi.fn()} />);
    expect(screen.getByText('invitationSuccess.emailSent')).toBeInTheDocument();
  });

  it('renders the back to users button', () => {
    render(<InvitationSuccessStep email="alice@example.com" onClose={vi.fn()} />);
    expect(screen.getByText('invitationSuccess.backToUsers')).toBeInTheDocument();
  });

  it('renders the link expiry note', () => {
    render(<InvitationSuccessStep email="alice@example.com" onClose={vi.fn()} />);
    expect(screen.getByText('invitationSuccess.linkExpiry')).toBeInTheDocument();
  });

  it('renders the countdown', () => {
    render(<InvitationSuccessStep email="alice@example.com" onClose={vi.fn()} />);
    expect(screen.getByText('invitationSuccess.redirecting')).toBeInTheDocument();
  });

  it('calls onClose when countdown reaches zero', () => {
    const onClose = vi.fn();
    render(<InvitationSuccessStep email="alice@example.com" onClose={onClose} />);
    // Countdown starts at 5; each tick decrements by 1, then 0 triggers onClose.
    for (let i = 0; i < 6; i++) {
      act(() => {
        vi.advanceTimersByTime(1000);
      });
    }
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when back to users button is clicked', () => {
    const onClose = vi.fn();
    render(<InvitationSuccessStep email="alice@example.com" onClose={onClose} />);
    fireEvent.click(screen.getByText('invitationSuccess.backToUsers'));
    expect(onClose).toHaveBeenCalled();
  });
});
