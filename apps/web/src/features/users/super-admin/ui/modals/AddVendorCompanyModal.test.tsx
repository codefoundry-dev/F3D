import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockMutate = vi.fn();
const mockUseCreateCompany = vi.fn().mockReturnValue({
  mutate: mockMutate,
  isPending: false,
  isError: false,
  error: null,
});

vi.mock('@/features/companies/services/companies.service', () => ({
  useCompanies: () => ({
    data: {
      items: [
        { id: 'c1', legalName: 'Contractor One' },
        { id: 'c2', legalName: 'Contractor Two' },
      ],
    },
  }),
  useCreateCompany: () => mockUseCreateCompany(),
}));

vi.mock('@forethread/ui-components', () => ({
  Modal: ({ children }: any) => <div data-testid="modal">{children}</div>,
  ModalBody: ({ children }: any) => <div>{children}</div>,
  ModalCloseButton: ({ onClose }: any) => <button data-testid="close-btn" onClick={onClose} />,
  Button: ({ children, ...p }: any) => <button {...p}>{children}</button>,
  IconBadge: () => <div data-testid="icon-badge" />,
  Input: ({ type, ...props }: any) => (
    <input data-testid={`input-${type ?? 'text'}`} type={type} {...props} />
  ),
  FormField: ({ children, label }: any) => (
    <div>
      <label>{label}</label>
      {children}
    </div>
  ),
  CustomDropdown: () => <div data-testid="dropdown" />,
  Checkbox: ({ checked, onChange, label }: any) => (
    <label>
      <input type="checkbox" checked={checked} onChange={() => onChange(!checked)} />
      {label}
    </label>
  ),
  Alert: ({ children }: any) => <div data-testid="alert">{children}</div>,
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
}));

vi.mock('@forethread/ui-components/assets/icons/briefcase.svg?react', () => ({
  default: (p: any) => <svg {...p} />,
}));
vi.mock('@forethread/ui-components/assets/icons/department.svg?react', () => ({
  default: (p: any) => <svg {...p} />,
}));
vi.mock('@forethread/ui-components/assets/icons/envelope-simple.svg?react', () => ({
  default: (p: any) => <svg {...p} />,
}));
vi.mock('@forethread/ui-components/assets/icons/suppliers.svg?react', () => ({
  default: (p: any) => <svg {...p} />,
}));

import { AddVendorCompanyModal } from './AddVendorCompanyModal';

describe('AddVendorCompanyModal', () => {
  const onClose = vi.fn();
  const onSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCreateCompany.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      isError: false,
      error: null,
    });
  });

  it('renders the modal with title', () => {
    render(<AddVendorCompanyModal onClose={onClose} onSuccess={onSuccess} />);
    expect(screen.getByText('addCompanyModal.createVendorTitle')).toBeInTheDocument();
    expect(screen.getByText('addCompanyModal.createVendorSubtitle')).toBeInTheDocument();
  });

  it('renders form fields', () => {
    render(<AddVendorCompanyModal onClose={onClose} onSuccess={onSuccess} />);
    expect(screen.getByText('addCompanyModal.companyName')).toBeInTheDocument();
    expect(screen.getByText('addCompanyModal.companyEmail')).toBeInTheDocument();
    expect(screen.getByText('addCompanyModal.specialisation')).toBeInTheDocument();
    expect(screen.getByText('addCompanyModal.assignContractors')).toBeInTheDocument();
  });

  it('renders contractor checkboxes', () => {
    render(<AddVendorCompanyModal onClose={onClose} onSuccess={onSuccess} />);
    expect(screen.getByText('Contractor One')).toBeInTheDocument();
    expect(screen.getByText('Contractor Two')).toBeInTheDocument();
  });

  it('renders cancel and create buttons', () => {
    render(<AddVendorCompanyModal onClose={onClose} onSuccess={onSuccess} />);
    expect(screen.getByText('common:cancel')).toBeInTheDocument();
    expect(screen.getByText('addCompanyModal.create')).toBeInTheDocument();
  });

  it('calls onClose when cancel button is clicked', () => {
    render(<AddVendorCompanyModal onClose={onClose} onSuccess={onSuccess} />);
    fireEvent.click(screen.getByText('common:cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when close button is clicked', () => {
    render(<AddVendorCompanyModal onClose={onClose} onSuccess={onSuccess} />);
    fireEvent.click(screen.getByTestId('close-btn'));
    expect(onClose).toHaveBeenCalled();
  });

  it('toggles contractor checkbox selection', () => {
    render(<AddVendorCompanyModal onClose={onClose} onSuccess={onSuccess} />);
    const contractorCheckbox = screen
      .getByText('Contractor One')
      .closest('label')!
      .querySelector('input')!;
    expect(contractorCheckbox).not.toBeChecked();
    fireEvent.click(contractorCheckbox);
    expect(contractorCheckbox).toBeChecked();
    // Toggle off
    fireEvent.click(contractorCheckbox);
    expect(contractorCheckbox).not.toBeChecked();
  });

  it('does not call mutate when company name is empty on submit', () => {
    render(<AddVendorCompanyModal onClose={onClose} onSuccess={onSuccess} />);
    fireEvent.submit(screen.getByTestId('input-text').closest('form')!);
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('calls mutate with correct data on submit', () => {
    render(<AddVendorCompanyModal onClose={onClose} onSuccess={onSuccess} />);
    fireEvent.change(screen.getByTestId('input-text'), { target: { value: 'Vendor Co' } });
    fireEvent.change(screen.getByTestId('input-email'), { target: { value: 'vendor@test.com' } });
    // Select a specialisation
    fireEvent.click(screen.getByText('Civil'));
    // Select a contractor
    fireEvent.click(screen.getByText('Contractor One'));
    fireEvent.submit(screen.getByTestId('input-text').closest('form')!);
    expect(mockMutate).toHaveBeenCalledWith(
      {
        type: 'VENDOR',
        legalName: 'Vendor Co',
        contactEmail: 'vendor@test.com',
        specialisations: ['Civil'],
        assignedContractorIds: ['c1'],
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('calls onSuccess and onClose callbacks on mutation success', () => {
    render(<AddVendorCompanyModal onClose={onClose} onSuccess={onSuccess} />);
    fireEvent.change(screen.getByTestId('input-text'), { target: { value: 'Vendor Co' } });
    fireEvent.click(screen.getByText('Contractor One'));
    fireEvent.submit(screen.getByTestId('input-text').closest('form')!);
    const mutateCall = mockMutate.mock.calls[0];
    const successCb = mutateCall[1].onSuccess;
    const fakeData = { id: 'v1', legalName: 'Vendor Co' };
    successCb(fakeData);
    expect(onSuccess).toHaveBeenCalledWith(fakeData);
    expect(onClose).toHaveBeenCalled();
  });

  it('shows error alert when mutation fails', () => {
    mockUseCreateCompany.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      isError: true,
      error: { response: { data: { error: 'Already exists' } } },
    });
    render(<AddVendorCompanyModal onClose={onClose} onSuccess={onSuccess} />);
    expect(screen.getByTestId('alert')).toBeInTheDocument();
    expect(screen.getByText('Already exists')).toBeInTheDocument();
  });

  it('shows generic error when no response error message', () => {
    mockUseCreateCompany.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      isError: true,
      error: {},
    });
    render(<AddVendorCompanyModal onClose={onClose} onSuccess={onSuccess} />);
    expect(screen.getByText('addCompanyModal.createError')).toBeInTheDocument();
  });

  it('shows loading state when mutation is pending', () => {
    mockUseCreateCompany.mockReturnValue({
      mutate: mockMutate,
      isPending: true,
      isError: false,
      error: null,
    });
    render(<AddVendorCompanyModal onClose={onClose} onSuccess={onSuccess} />);
    expect(screen.getByText('addCompanyModal.creating')).toBeInTheDocument();
  });

  it('submit button is disabled when company name is empty', () => {
    render(<AddVendorCompanyModal onClose={onClose} onSuccess={onSuccess} />);
    const submitBtn = screen.getByText('addCompanyModal.create');
    expect(submitBtn).toBeDisabled();
  });

  it('submit button is disabled when no contractors selected', () => {
    render(<AddVendorCompanyModal onClose={onClose} onSuccess={onSuccess} />);
    fireEvent.change(screen.getByTestId('input-text'), { target: { value: 'Vendor Co' } });
    const submitBtn = screen.getByText('addCompanyModal.create');
    expect(submitBtn).toBeDisabled();
  });

  it('sends undefined for contactEmail when empty', () => {
    render(<AddVendorCompanyModal onClose={onClose} onSuccess={onSuccess} />);
    fireEvent.change(screen.getByTestId('input-text'), { target: { value: 'Vendor Co' } });
    fireEvent.click(screen.getByText('Contractor One'));
    fireEvent.submit(screen.getByTestId('input-text').closest('form')!);
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ contactEmail: undefined }),
      expect.anything(),
    );
  });
});
