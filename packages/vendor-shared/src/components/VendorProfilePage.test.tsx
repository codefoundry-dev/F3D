import type { VendorProfile } from '@forethread/api-client';

const mockProfile = vi.hoisted<VendorProfile>(() => ({
  id: 'vendor-1',
  legalName: 'Acme Pty Ltd',
  tradeName: 'Acme Corp',
  abn: '12345678901',
  taxCode: 'GST-001',
  legalAddress: '123 Main St, Sydney NSW 2000',
  contactEmail: 'contact@acme.com',
  contactPhone: '+61 400 000 000',
  website: 'https://acme.com',
  logoUrl: null,
  specialisations: ['Plumbing', 'Electrical'],
  warehouseLocations: [
    {
      id: 'wh-1',
      name: 'Australia',
      city: 'Sydney',
      postcode: '2000',
      address: '123 Main St',
    },
  ],
  representatives: [
    {
      id: 'rep-1',
      name: 'John Doe',
      email: 'john@acme.com',
      phone: '+61 400 111 111',
      position: 'Sales Manager',
    },
  ],
}));

const mockMutateAsync = vi.hoisted(() => vi.fn().mockResolvedValue(mockProfile));
const mockDeleteMutateAsync = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockAddRepMutateAsync = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ id: 'rep-new', status: 'INVITED' }),
);
const mockUseVendorProfile = vi.hoisted(() =>
  vi.fn(() => ({
    data: mockProfile,
    isLoading: false,
  })),
);

vi.mock('../services', () => ({
  useVendorProfile: mockUseVendorProfile,
  useUpdateVendorProfile: vi.fn(() => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  })),
  useDeleteWarehouse: vi.fn(() => ({
    mutateAsync: mockDeleteMutateAsync,
  })),
  // Hooks consumed by useVendorProfileForm / WarehouseCard. Stubbed so the
  // component tree renders; the suite only asserts on profile + update.
  useVendorLogoUrl: vi.fn(() => ({ data: null, isLoading: false })),
  useUploadVendorLogo: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isPending: false,
  })),
  useAddWarehouse: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isPending: false,
  })),
  useUpdateWarehouse: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isPending: false,
  })),
  useAddVendorRepresentative: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: mockAddRepMutateAsync,
    isPending: false,
  })),
}));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts && 'defaultValue' in opts) return opts.defaultValue as string;
      return key;
    },
  }),
}));

// Minimal but behaviour-faithful stubs for the ui-components the profile tree
// renders (vendor-shared's vitest has no svg plugin, so the real components —
// which import .svg?react — can't load here).
vi.mock('@forethread/ui-components', () => ({
  Spinner: () => <div data-testid="spinner" />,
  notificationService: { success: vi.fn(), error: vi.fn() },
  AvatarUpload: ({ name }: { name?: string }) => (
    <div>
      {String(name ?? '')
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()}
    </div>
  ),
  Button: ({
    children,
    onClick,
    type,
    disabled,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    type?: 'button' | 'submit' | 'reset';
    disabled?: boolean;
  }) => (
    <button type={type} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  FormField: ({ label, children }: { label?: React.ReactNode; children?: React.ReactNode }) => (
    <div>
      {label}
      {children}
    </div>
  ),
  Input: ({
    value,
    onChange,
    placeholder,
  }: {
    value?: string;
    onChange?: (e: { target: { value: string } }) => void;
    placeholder?: string;
  }) => <input value={value ?? ''} onChange={onChange} placeholder={placeholder} />,
  AddressInput: ({
    value,
    onChange,
    placeholder,
  }: {
    value?: string;
    onChange?: (val: string) => void;
    placeholder?: string;
  }) => (
    <input
      value={value ?? ''}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
    />
  ),
  CustomDropdown: ({ value, placeholder }: { value?: string; placeholder?: string }) => (
    <div>{value ?? placeholder}</div>
  ),
  onPhoneOnly: () => {},
}));

const SvgStub = vi.hoisted(() => () => null);

vi.mock('@forethread/ui-components/assets/icons/abn.svg?react', () => ({ default: SvgStub }));
vi.mock('@forethread/ui-components/assets/icons/delete.svg?react', () => ({ default: SvgStub }));
vi.mock('@forethread/ui-components/assets/icons/edit-without-line.svg?react', () => ({
  default: SvgStub,
}));
vi.mock('@forethread/ui-components/assets/icons/plus.svg?react', () => ({ default: SvgStub }));
vi.mock('@forethread/ui-components/assets/icons/envelope-simple.svg?react', () => ({
  default: SvgStub,
}));
vi.mock('@forethread/ui-components/assets/icons/file-text.svg?react', () => ({
  default: SvgStub,
}));
vi.mock('@forethread/ui-components/assets/icons/id-badge.svg?react', () => ({ default: SvgStub }));
vi.mock('@forethread/ui-components/assets/icons/legal-name.svg?react', () => ({
  default: SvgStub,
}));
vi.mock('@forethread/ui-components/assets/icons/location.svg?react', () => ({ default: SvgStub }));
vi.mock('@forethread/ui-components/assets/icons/phone.svg?react', () => ({ default: SvgStub }));
vi.mock('@forethread/ui-components/assets/icons/tax.svg?react', () => ({ default: SvgStub }));
vi.mock('@forethread/ui-components/assets/icons/user-outline.svg?react', () => ({
  default: SvgStub,
}));
vi.mock('@forethread/ui-components/assets/icons/web.svg?react', () => ({ default: SvgStub }));
vi.mock('@forethread/ui-components/assets/icons/wrench.svg?react', () => ({ default: SvgStub }));

import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import VendorProfilePage from './VendorProfilePage';

describe('VendorProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseVendorProfile.mockReturnValue({
      data: mockProfile,
      isLoading: false,
    });
  });

  it('renders the company name and email', () => {
    render(<VendorProfilePage vendorId="vendor-1" />);

    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getAllByText('contact@acme.com').length).toBeGreaterThanOrEqual(1);
  });

  it('renders initials in the avatar', () => {
    render(<VendorProfilePage vendorId="vendor-1" />);

    expect(screen.getByText('AC')).toBeInTheDocument();
  });

  it('renders legal information fields', () => {
    render(<VendorProfilePage vendorId="vendor-1" />);

    expect(screen.getByText('Legal Information')).toBeInTheDocument();
    expect(screen.getByText('Acme Pty Ltd')).toBeInTheDocument();
    expect(screen.getByText('Plumbing, Electrical')).toBeInTheDocument();
    expect(screen.getByText('12345678901')).toBeInTheDocument();
    expect(screen.getByText('GST-001')).toBeInTheDocument();
    expect(screen.getByText('123 Main St, Sydney NSW 2000')).toBeInTheDocument();
  });

  it('renders contact information fields', () => {
    render(<VendorProfilePage vendorId="vendor-1" />);

    expect(screen.getByText('Contact Information')).toBeInTheDocument();
    expect(screen.getByText('+61 400 000 000')).toBeInTheDocument();
    expect(screen.getByText('https://acme.com')).toBeInTheDocument();
  });

  it('renders the representatives section with the rep details in view mode', () => {
    render(<VendorProfilePage vendorId="vendor-1" />);

    expect(screen.getByText("Representatives' details")).toBeInTheDocument();
    // View mode lists the existing representatives (US 3.07).
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('john@acme.com')).toBeInTheDocument();
    expect(screen.getByText('Sales Manager')).toBeInTheDocument();
  });

  it('renders the Add user and Invite user actions', () => {
    render(<VendorProfilePage vendorId="vendor-1" />);

    expect(screen.getByText('Add user')).toBeInTheDocument();
    expect(screen.getByText('Invite user')).toBeInTheDocument();
  });

  it('renders warehouse locations', () => {
    render(<VendorProfilePage vendorId="vendor-1" />);

    expect(screen.getByText('Warehouse locations')).toBeInTheDocument();
    expect(screen.getByText('Australia')).toBeInTheDocument();
    expect(screen.getByText('Sydney')).toBeInTheDocument();
    expect(screen.getByText('123 Main St')).toBeInTheDocument();
    expect(screen.getByText('2000')).toBeInTheDocument();
  });

  it('shows Edit Profile button in view mode', () => {
    render(<VendorProfilePage vendorId="vendor-1" />);

    expect(screen.getByText('Edit Profile')).toBeInTheDocument();
  });

  it('switches to edit mode when Edit Profile is clicked', () => {
    render(<VendorProfilePage vendorId="vendor-1" />);

    fireEvent.click(screen.getByText('Edit Profile'));

    expect(screen.getByText('Submit')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.queryByText('Edit Profile')).not.toBeInTheDocument();
  });

  it('populates form fields with current values in edit mode', () => {
    render(<VendorProfilePage vendorId="vendor-1" />);

    fireEvent.click(screen.getByText('Edit Profile'));

    const inputs = screen.getAllByRole('textbox');
    const values = inputs.map((input) => (input as HTMLInputElement).value);

    expect(values).toContain('Acme Pty Ltd');
    expect(values).toContain('12345678901');
    expect(values).toContain('contact@acme.com');
  });

  it('returns to view mode when Cancel is clicked', () => {
    render(<VendorProfilePage vendorId="vendor-1" />);

    fireEvent.click(screen.getByText('Edit Profile'));
    fireEvent.click(screen.getByText('Cancel'));

    expect(screen.getByText('Edit Profile')).toBeInTheDocument();
    expect(screen.queryByText('Submit')).not.toBeInTheDocument();
  });

  it('calls updateProfile on Submit', async () => {
    render(<VendorProfilePage vendorId="vendor-1" />);

    fireEvent.click(screen.getByText('Edit Profile'));

    // Submit is gated on the form being dirty — edit a non-asserted field first.
    fireEvent.change(screen.getByDisplayValue('https://acme.com'), {
      target: { value: 'https://acme.com/updated' },
    });
    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'vendor-1',
          dto: expect.objectContaining({
            legalName: 'Acme Pty Ltd',
            abn: '12345678901',
          }),
        }),
      );
    });
  });

  it('persists an added representative without sending an invitation (FOR-272)', async () => {
    render(<VendorProfilePage vendorId="vendor-1" />);

    // "Add user" flips to edit mode and seeds an empty draft row.
    fireEvent.click(screen.getByText('Add user'));

    fireEvent.change(screen.getByPlaceholderText('Name Surname'), {
      target: { value: 'Jane Smith' },
    });
    fireEvent.change(screen.getByPlaceholderText('email@company.com'), {
      target: { value: 'jane@acme.com' },
    });

    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(mockAddRepMutateAsync).toHaveBeenCalledWith({
        vendorId: 'vendor-1',
        input: expect.objectContaining({ name: 'Jane Smith', email: 'jane@acme.com' }),
      });
    });
  });

  it('does not call addRepresentative when no draft is filled', async () => {
    render(<VendorProfilePage vendorId="vendor-1" />);

    fireEvent.click(screen.getByText('Edit Profile'));
    fireEvent.change(screen.getByDisplayValue('https://acme.com'), {
      target: { value: 'https://acme.com/updated' },
    });
    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalled();
    });
    expect(mockAddRepMutateAsync).not.toHaveBeenCalled();
  });

  it('adds a representative even when the profile is missing required fields (FOR-272)', async () => {
    mockUseVendorProfile.mockReturnValue({
      data: { ...mockProfile, abn: null, taxCode: null, legalAddress: null },
      isLoading: false,
    });

    render(<VendorProfilePage vendorId="vendor-1" />);

    fireEvent.click(screen.getByText('Add user'));
    fireEvent.change(screen.getByPlaceholderText('Name Surname'), {
      target: { value: 'Jane Smith' },
    });
    fireEvent.change(screen.getByPlaceholderText('email@company.com'), {
      target: { value: 'jane@acme.com' },
    });
    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(mockAddRepMutateAsync).toHaveBeenCalledWith({
        vendorId: 'vendor-1',
        input: expect.objectContaining({ name: 'Jane Smith', email: 'jane@acme.com' }),
      });
    });
    // The incomplete profile is not patched, so no required-field errors block the add.
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('shows loading spinner when data is loading', () => {
    mockUseVendorProfile.mockReturnValueOnce({
      data: undefined,
      isLoading: true,
    });

    render(<VendorProfilePage vendorId="vendor-1" />);

    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('shows profile not found when data is null', () => {
    mockUseVendorProfile.mockReturnValueOnce({
      data: undefined,
      isLoading: false,
    });

    render(<VendorProfilePage vendorId="vendor-1" />);

    expect(screen.getByText('Profile not found')).toBeInTheDocument();
  });
});
