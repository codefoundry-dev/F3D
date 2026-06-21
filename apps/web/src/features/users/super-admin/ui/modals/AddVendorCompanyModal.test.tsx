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
  useCreateCompany: () => mockUseCreateCompany(),
}));

vi.mock('@forethread/ui-components', () => ({
  Modal: ({ children }: any) => <div data-testid="modal">{children}</div>,
  ModalGridBackground: () => <div data-testid="modal-grid-bg" />,
  ModalGridHeader: ({ title, subtitle }: any) => (
    <div data-testid="modal-grid-header">
      <div>{title}</div>
      {subtitle ? <div>{subtitle}</div> : null}
    </div>
  ),
  REGISTRATION_MODAL_CARD_CLASS: '',
  Button: ({ children, ...p }: any) => <button {...p}>{children}</button>,
  Input: ({ type, ...props }: any) => (
    <input data-testid={`input-${type ?? 'text'}`} type={type} {...props} />
  ),
  FormField: ({ children, label }: any) => (
    <div>
      <label>{label}</label>
      {children}
    </div>
  ),
  CustomDropdown: ({ options, onChange, placeholder }: any) => (
    <div data-testid="dropdown">
      <span>{placeholder}</span>
      {options?.map((o: any) => (
        <button key={o.value} data-testid={`spec-${o.value}`} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  ),
  Alert: ({ children }: any) => <div data-testid="alert">{children}</div>,
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
}));

vi.mock('@forethread/ui-components/assets/icons/department.svg?react', () => ({
  default: (p: any) => <svg {...p} />,
}));
vi.mock('@forethread/ui-components/assets/icons/envelope-simple.svg?react', () => ({
  default: (p: any) => <svg {...p} />,
}));
vi.mock('@forethread/ui-components/assets/icons/wrench.svg?react', () => ({
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
  });

  it('does not render an assign-contractors field', () => {
    render(<AddVendorCompanyModal onClose={onClose} onSuccess={onSuccess} />);
    expect(screen.queryByText('addCompanyModal.assignContractors')).not.toBeInTheDocument();
  });

  it('renders the specialisation dropdown with placeholder', () => {
    render(<AddVendorCompanyModal onClose={onClose} onSuccess={onSuccess} />);
    expect(screen.getByTestId('dropdown')).toBeInTheDocument();
    expect(screen.getByText('addCompanyModal.selectSpecialisation')).toBeInTheDocument();
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

  it('does not call mutate when company name is empty on submit', () => {
    render(<AddVendorCompanyModal onClose={onClose} onSuccess={onSuccess} />);
    fireEvent.submit(screen.getByTestId('input-text').closest('form')!);
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('calls mutate with a single specialisation and no assignedContractorIds', () => {
    render(<AddVendorCompanyModal onClose={onClose} onSuccess={onSuccess} />);
    fireEvent.change(screen.getByTestId('input-text'), { target: { value: 'Vendor Co' } });
    fireEvent.change(screen.getByTestId('input-email'), { target: { value: 'vendor@test.com' } });
    fireEvent.click(screen.getByTestId('spec-Civil'));
    fireEvent.submit(screen.getByTestId('input-text').closest('form')!);
    expect(mockMutate).toHaveBeenCalledWith(
      {
        type: 'VENDOR',
        legalName: 'Vendor Co',
        contactEmail: 'vendor@test.com',
        specialisations: ['Civil'],
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('omits specialisations when none chosen', () => {
    render(<AddVendorCompanyModal onClose={onClose} onSuccess={onSuccess} />);
    fireEvent.change(screen.getByTestId('input-text'), { target: { value: 'Vendor Co' } });
    fireEvent.submit(screen.getByTestId('input-text').closest('form')!);
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ specialisations: undefined }),
      expect.anything(),
    );
  });

  it('calls onSuccess and onClose callbacks on mutation success', () => {
    render(<AddVendorCompanyModal onClose={onClose} onSuccess={onSuccess} />);
    fireEvent.change(screen.getByTestId('input-text'), { target: { value: 'Vendor Co' } });
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

  it('submit button is enabled when company name is filled (no contractor required)', () => {
    render(<AddVendorCompanyModal onClose={onClose} onSuccess={onSuccess} />);
    fireEvent.change(screen.getByTestId('input-text'), { target: { value: 'Vendor Co' } });
    const submitBtn = screen.getByText('addCompanyModal.create');
    expect(submitBtn).not.toBeDisabled();
  });

  it('sends undefined for contactEmail when empty', () => {
    render(<AddVendorCompanyModal onClose={onClose} onSuccess={onSuccess} />);
    fireEvent.change(screen.getByTestId('input-text'), { target: { value: 'Vendor Co' } });
    fireEvent.submit(screen.getByTestId('input-text').closest('form')!);
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ contactEmail: undefined }),
      expect.anything(),
    );
  });
});
