import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/ui-components', () => ({
  Button: ({
    children,
    onClick,
    isLoading,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    isLoading?: boolean;
  }) => (
    <button type="button" onClick={onClick} disabled={isLoading}>
      {children}
    </button>
  ),
}));
vi.mock('@forethread/ui-components/assets/icons/image.svg?react', () => ({
  default: () => <div data-testid="placeholder-icon" />,
}));

const mockHook = vi.hoisted(() => ({
  logoUrl: undefined as string | undefined,
  isPending: false,
  openFilePicker: vi.fn(),
  handleLogoChange: vi.fn(),
}));
vi.mock('../hooks/useCompanyLogo', () => ({
  useCompanyLogo: () => ({ ...mockHook, inputRef: { current: null } }),
}));

import { CompanyLogoCard } from './CompanyLogoCard';

describe('CompanyLogoCard (FOR-389)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHook.logoUrl = undefined;
    mockHook.isPending = false;
  });

  it('explains that the logo appears on PO and invoice PDFs', () => {
    render(<CompanyLogoCard companyId="c1" />);
    expect(screen.getByText('logoCard.title')).toBeInTheDocument();
    expect(screen.getByText('logoPdfHint')).toBeInTheDocument();
  });

  it('offers "Upload" with a placeholder when there is no logo yet', () => {
    render(<CompanyLogoCard companyId="c1" />);
    expect(screen.getByTestId('placeholder-icon')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'logoCard.upload' }));
    expect(mockHook.openFilePicker).toHaveBeenCalled();
  });

  it('previews the current logo and offers "Change"', () => {
    mockHook.logoUrl = 'https://logo.example.com/logo.png';
    render(<CompanyLogoCard companyId="c1" />);
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://logo.example.com/logo.png');
    expect(screen.getByRole('button', { name: 'logoCard.change' })).toBeInTheDocument();
  });

  it('wires the hidden file input to the upload handler', () => {
    render(<CompanyLogoCard companyId="c1" />);
    const input = screen.getByTestId('company-logo-input');
    expect(input).toHaveAttribute('accept', '.jpg,.jpeg,.png,.webp,.svg');
    fireEvent.change(input, { target: { files: [] } });
    expect(mockHook.handleLogoChange).toHaveBeenCalled();
  });

  it('disables the button while uploading', () => {
    mockHook.isPending = true;
    render(<CompanyLogoCard companyId="c1" />);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
