import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/ui-components/assets/icons/clock.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/download.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/edit-without-line.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/envelope-simple.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/eye-opened.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/legal-name.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/location.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/my-abn.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/phone.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/tax.svg?react', () => ({ default: () => <div /> }));
vi.mock('@forethread/ui-components/assets/icons/trade-name.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/web.svg?react', () => ({ default: () => <div /> }));

vi.mock('@forethread/ui-components', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button data-testid="button" onClick={onClick} {...props}>
      {children}
    </button>
  ),
  Spinner: ({ size }: any) => <div data-testid="spinner" data-size={size} />,
  Input: ({ leftIcon: _leftIcon, ...props }: any) => <input data-testid="input" {...props} />,
  AddressInput: ({ value, onChange, ...props }: any) => (
    <input
      data-testid="address-input"
      value={value}
      onChange={(e: any) => onChange(e.target.value)}
      {...props}
    />
  ),
  FormField: ({ children, label }: any) => (
    <div data-testid="form-field" data-label={label}>
      {children}
    </div>
  ),
  Alert: ({ children }: any) => <div data-testid="alert">{children}</div>,
  onPhoneOnly: vi.fn(),
  // Edit Company Details modal primitives
  Modal: ({ children }: any) => <div data-testid="modal">{children}</div>,
  ModalBody: ({ children }: any) => <div data-testid="modal-body">{children}</div>,
  ModalIconHeader: ({ title, subtitle }: any) => (
    <div data-testid="modal-icon-header">
      <span>{title}</span>
      {subtitle && <span>{subtitle}</span>}
    </div>
  ),
}));

const mockUseAuthStore = vi.hoisted(() => vi.fn());
vi.mock('@/features/auth/state/auth.store', () => ({
  useAuthStore: (selector: any) => mockUseAuthStore(selector),
}));

const mockUseCompanyLogo = vi.hoisted(() => vi.fn());
vi.mock('../hooks/useCompanyLogo', () => ({
  useCompanyLogo: (...args: unknown[]) => mockUseCompanyLogo(...args),
}));

const mockGetCompany = vi.hoisted(() => vi.fn());
const mockGetCompanyDocuments = vi.hoisted(() => vi.fn());
const mockGetFileUrl = vi.hoisted(() => vi.fn());
const mockUpdateCompany = vi.hoisted(() => vi.fn());
const mockSearchAddresses = vi.hoisted(() => vi.fn());
vi.mock('@forethread/api-client', () => ({
  getCompany: (...args: unknown[]) => mockGetCompany(...args),
  getCompanyDocuments: (...args: unknown[]) => mockGetCompanyDocuments(...args),
  getFileUrl: (...args: unknown[]) => mockGetFileUrl(...args),
  updateCompany: (...args: unknown[]) => mockUpdateCompany(...args),
  searchAddresses: (...args: unknown[]) => mockSearchAddresses(...args),
}));

const mockUseQueryResults = vi.hoisted(() => ({
  companyResult: { data: undefined as any, isLoading: false },
  docsResult: { data: undefined as any },
}));

const mockMutate = vi.hoisted(() => vi.fn());
const mockMutationReset = vi.hoisted(() => vi.fn());
const mockInvalidateQueries = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('@tanstack/react-query', () => ({
  useQuery: (opts: { queryKey: string[] }) => {
    if (opts.queryKey[0] === 'company-profile') {
      return mockUseQueryResults.companyResult;
    }
    if (opts.queryKey[0] === 'company-documents') {
      return mockUseQueryResults.docsResult;
    }
    return { data: undefined };
  },
  useMutation: () => ({
    mutate: mockMutate,
    isPending: false,
    isError: false,
    reset: mockMutationReset,
  }),
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

import CompanyProfilePage from './CompanyProfilePage';

const mockCompany = {
  id: 'c1',
  legalName: 'Acme Corp',
  tradeName: 'Acme',
  abn: '12345678901',
  taxCode: '999',
  legalAddress: '123 Main St',
  contactEmail: 'info@acme.com',
  contactPhone: '+61400000000',
  website: 'https://acme.com',
  specialisations: ['Electrical', 'Plumbing'],
  type: 'CONTRACTOR' as const,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

const mockDocuments = [
  {
    id: 'doc1',
    createdAt: '2026-02-15',
    file: {
      id: 'f1',
      filename: 'insurance.pdf',
      uploadedBy: { email: 'admin@acme.com' },
    },
  },
];

describe('CompanyProfilePage (buyer)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuthStore.mockImplementation((selector: any) =>
      selector({ currentUser: { companyId: 'c1' } }),
    );
    mockUseCompanyLogo.mockReturnValue({
      logoUrl: null,
      inputRef: { current: null },
      isPending: false,
      handleLogoChange: vi.fn(),
      openFilePicker: vi.fn(),
    });
    mockUseQueryResults.companyResult = { data: undefined, isLoading: false };
    mockUseQueryResults.docsResult = { data: undefined };
  });

  it('shows spinner when loading', () => {
    mockUseQueryResults.companyResult = { data: undefined, isLoading: true };
    render(<CompanyProfilePage />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('renders nothing when company is null and not loading', () => {
    mockUseQueryResults.companyResult = { data: undefined, isLoading: false };
    const { container } = render(<CompanyProfilePage />);
    expect(container.innerHTML).toBe('');
  });

  it('renders company legal name when data loaded', () => {
    mockUseQueryResults.companyResult = { data: mockCompany, isLoading: false };
    render(<CompanyProfilePage />);
    const matches = screen.getAllByText('Acme Corp');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders contact email in header', () => {
    mockUseQueryResults.companyResult = { data: mockCompany, isLoading: false };
    render(<CompanyProfilePage />);
    const matches = screen.getAllByText('info@acme.com');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders legal info section', () => {
    mockUseQueryResults.companyResult = { data: mockCompany, isLoading: false };
    render(<CompanyProfilePage />);
    expect(screen.getByText('legalInfo')).toBeInTheDocument();
  });

  it('renders contact info section', () => {
    mockUseQueryResults.companyResult = { data: mockCompany, isLoading: false };
    render(<CompanyProfilePage />);
    expect(screen.getByText('contactInfo')).toBeInTheDocument();
  });

  it('renders specialisations', () => {
    mockUseQueryResults.companyResult = { data: mockCompany, isLoading: false };
    render(<CompanyProfilePage />);
    expect(screen.getByText('specialisations')).toBeInTheDocument();
    expect(screen.getByText('Electrical')).toBeInTheDocument();
    expect(screen.getByText('Plumbing')).toBeInTheDocument();
  });

  it('does not render specialisations section when empty', () => {
    mockUseQueryResults.companyResult = {
      data: { ...mockCompany, specialisations: [] },
      isLoading: false,
    };
    render(<CompanyProfilePage />);
    expect(screen.queryByText('specialisations')).not.toBeInTheDocument();
  });

  it('renders compliance documents section heading', () => {
    mockUseQueryResults.companyResult = { data: mockCompany, isLoading: false };
    render(<CompanyProfilePage />);
    expect(screen.getByText('complianceDocuments')).toBeInTheDocument();
  });

  it('shows no documents message when documents empty', () => {
    mockUseQueryResults.companyResult = { data: mockCompany, isLoading: false };
    mockUseQueryResults.docsResult = { data: [] };
    render(<CompanyProfilePage />);
    expect(screen.getByText('noDocuments')).toBeInTheDocument();
  });

  it('renders documents when present', () => {
    mockUseQueryResults.companyResult = { data: mockCompany, isLoading: false };
    mockUseQueryResults.docsResult = { data: mockDocuments };
    render(<CompanyProfilePage />);
    expect(screen.getByText('insurance.pdf')).toBeInTheDocument();
    expect(screen.getByText('admin@acme.com')).toBeInTheDocument();
  });

  it('renders initials when no logo', () => {
    mockUseQueryResults.companyResult = { data: mockCompany, isLoading: false };
    render(<CompanyProfilePage />);
    // "Acme Corp" -> "AC"
    expect(screen.getByText('AC')).toBeInTheDocument();
  });

  it('renders logo image when logoUrl is present', () => {
    mockUseCompanyLogo.mockReturnValue({
      logoUrl: 'https://example.com/logo.png',
      inputRef: { current: null },
      isPending: false,
      handleLogoChange: vi.fn(),
      openFilePicker: vi.fn(),
    });
    mockUseQueryResults.companyResult = { data: mockCompany, isLoading: false };
    render(<CompanyProfilePage />);
    const img = screen.getByAltText('Acme Corp');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/logo.png');
  });

  it('opens the Edit Company Details modal when edit button is clicked', () => {
    mockUseQueryResults.companyResult = { data: mockCompany, isLoading: false };
    render(<CompanyProfilePage />);
    expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('editProfile'));
    // The modal opens, showing its header + stacked submit/cancel footer.
    expect(screen.getByTestId('modal')).toBeInTheDocument();
    expect(screen.getByText('editModal.title')).toBeInTheDocument();
    expect(screen.getByText('editModal.submit')).toBeInTheDocument();
    expect(screen.getByText('common:cancel')).toBeInTheDocument();
  });

  it('closes the edit modal when cancel is clicked', () => {
    mockUseQueryResults.companyResult = { data: mockCompany, isLoading: false };
    render(<CompanyProfilePage />);
    fireEvent.click(screen.getByText('editProfile'));
    expect(screen.getByTestId('modal')).toBeInTheDocument();
    fireEvent.click(screen.getByText('common:cancel'));
    expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
  });

  it('calls mutate when submit is clicked in the edit modal', () => {
    mockUseQueryResults.companyResult = { data: mockCompany, isLoading: false };
    render(<CompanyProfilePage />);
    fireEvent.click(screen.getByText('editProfile'));
    fireEvent.click(screen.getByText('editModal.submit'));
    expect(mockMutate).toHaveBeenCalled();
  });

  it('renders change avatar button', () => {
    mockUseQueryResults.companyResult = { data: mockCompany, isLoading: false };
    render(<CompanyProfilePage />);
    expect(screen.getByLabelText('Change avatar')).toBeInTheDocument();
  });

  it('renders dash for null contact email in header', () => {
    mockUseQueryResults.companyResult = {
      data: { ...mockCompany, contactEmail: null },
      isLoading: false,
    };
    render(<CompanyProfilePage />);
    // The header should not render the email div if contactEmail is falsy
    // But the InfoItem for contactEmail should show dash
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('shows spinner on avatar button when upload is pending', () => {
    mockUseCompanyLogo.mockReturnValue({
      logoUrl: null,
      inputRef: { current: null },
      isPending: true,
      handleLogoChange: vi.fn(),
      openFilePicker: vi.fn(),
    });
    mockUseQueryResults.companyResult = { data: mockCompany, isLoading: false };
    render(<CompanyProfilePage />);
    const avatarBtn = screen.getByLabelText('Change avatar');
    expect(avatarBtn).toBeDisabled();
  });

  it('calls openFilePicker when change avatar button is clicked', () => {
    const mockOpenFilePicker = vi.fn();
    mockUseCompanyLogo.mockReturnValue({
      logoUrl: null,
      inputRef: { current: null },
      isPending: false,
      handleLogoChange: vi.fn(),
      openFilePicker: mockOpenFilePicker,
    });
    mockUseQueryResults.companyResult = { data: mockCompany, isLoading: false };
    render(<CompanyProfilePage />);
    fireEvent.click(screen.getByLabelText('Change avatar'));
    expect(mockOpenFilePicker).toHaveBeenCalled();
  });

  it('calls handleLogoChange when file input changes', () => {
    const mockHandleLogoChange = vi.fn();
    mockUseCompanyLogo.mockReturnValue({
      logoUrl: null,
      inputRef: { current: null },
      isPending: false,
      handleLogoChange: mockHandleLogoChange,
      openFilePicker: vi.fn(),
    });
    mockUseQueryResults.companyResult = { data: mockCompany, isLoading: false };
    render(<CompanyProfilePage />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: { files: [new File([''], 'logo.png', { type: 'image/png' })] },
    });
    expect(mockHandleLogoChange).toHaveBeenCalled();
  });

  it('formats document dates correctly', () => {
    mockUseQueryResults.companyResult = { data: mockCompany, isLoading: false };
    mockUseQueryResults.docsResult = { data: mockDocuments };
    render(<CompanyProfilePage />);
    // The formatDate function should render the date from mockDocuments[0].createdAt = '2026-02-15'
    // in en-AU locale: 15/02/2026
    expect(screen.getByText('15/02/2026')).toBeInTheDocument();
  });

  it('calls handleView when view button is clicked on a document', () => {
    mockUseQueryResults.companyResult = { data: mockCompany, isLoading: false };
    mockUseQueryResults.docsResult = { data: mockDocuments };
    mockGetFileUrl.mockResolvedValue({ url: 'https://example.com/file' });
    const mockOpen = vi.fn(() => ({ location: { href: '' } }));
    vi.stubGlobal('open', mockOpen);
    render(<CompanyProfilePage />);
    const viewBtn = screen.getByLabelText('View');
    fireEvent.click(viewBtn);
    expect(mockOpen).toHaveBeenCalledWith('', '_blank');
  });

  it('calls handleDownload when download button is clicked on a document', () => {
    mockUseQueryResults.companyResult = { data: mockCompany, isLoading: false };
    mockUseQueryResults.docsResult = { data: mockDocuments };
    mockGetFileUrl.mockResolvedValue({ url: 'https://example.com/file' });
    render(<CompanyProfilePage />);
    const downloadBtn = screen.getByLabelText('Download');
    fireEvent.click(downloadBtn);
    expect(mockGetFileUrl).toHaveBeenCalledWith('f1');
  });
});
