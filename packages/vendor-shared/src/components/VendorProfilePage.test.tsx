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
}));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts && 'defaultValue' in opts) return opts.defaultValue as string;
      return key;
    },
  }),
}));

vi.mock('@forethread/ui-components', () => ({
  Spinner: () => <div data-testid="spinner" />,
}));

const SvgStub = vi.hoisted(() => () => null);

vi.mock('@forethread/ui-components/assets/icons/abn.svg?react', () => ({ default: SvgStub }));
vi.mock('@forethread/ui-components/assets/icons/delete.svg?react', () => ({ default: SvgStub }));
vi.mock('@forethread/ui-components/assets/icons/edit.svg?react', () => ({ default: SvgStub }));
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

  it('renders representative details', () => {
    render(<VendorProfilePage vendorId="vendor-1" />);

    expect(screen.getByText("Representatives' details")).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('john@acme.com')).toBeInTheDocument();
    expect(screen.getByText('+61 400 111 111')).toBeInTheDocument();
    expect(screen.getByText('Sales Manager')).toBeInTheDocument();
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
