const mockOnClose = vi.hoisted(() => vi.fn());

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts && 'seconds' in opts) return `${key}::${opts.seconds}`;
      if (opts && 'email' in opts) return `${key}::${opts.email}`;
      if (opts && 'defaultValue' in opts) return opts.defaultValue as string;
      return key;
    },
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
    <div data-testid="modal" onClick={onClose}>
      <span>{title}</span>
      <span>{subtitle}</span>
      <div>{description}</div>
      {note && <span>{note}</span>}
      <button onClick={onClose}>{buttonLabel}</button>
      <span>{redirectLabel(3)}</span>
    </div>
  ),
}));

vi.mock('@forethread/ui-components/assets/icons/checkcircle-icon.svg?react', () => ({
  default: () => <span />,
}));

import { render, screen, fireEvent } from '@testing-library/react';

import { VendorInviteSuccessModal } from './VendorInviteSuccessModal';

describe('VendorInviteSuccessModal', () => {
  beforeEach(() => {
    mockOnClose.mockClear();
  });

  it('renders title for new invitation', () => {
    render(<VendorInviteSuccessModal email="test@example.com" onClose={mockOnClose} />);

    expect(screen.getByText('inviteSuccess.title')).toBeInTheDocument();
  });

  it('renders email info box for new invitation', () => {
    render(<VendorInviteSuccessModal email="test@example.com" onClose={mockOnClose} />);

    const infoBox = screen.getByText('inviteSuccess.info::test@example.com');
    expect(infoBox).toBeInTheDocument();
  });

  it('renders countdown text', () => {
    render(<VendorInviteSuccessModal email="test@example.com" onClose={mockOnClose} />);

    expect(screen.getByText('inviteSuccess.redirecting::3')).toBeInTheDocument();
  });

  it('clicking the back button calls onClose', () => {
    render(<VendorInviteSuccessModal email="test@example.com" onClose={mockOnClose} />);

    const backButton = screen.getByText('inviteSuccess.backToVendors');
    fireEvent.click(backButton);

    expect(mockOnClose).toHaveBeenCalled();
  });
});
