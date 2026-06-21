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
  Input: (props: any) => <input data-testid="input" {...props} />,
  FormField: ({ children, label }: any) => (
    <div>
      <label>{label}</label>
      {children}
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

import { AddContractorCompanyModal } from './AddContractorCompanyModal';

describe('AddContractorCompanyModal', () => {
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
    render(<AddContractorCompanyModal onClose={onClose} onSuccess={onSuccess} />);
    expect(screen.getByText('addCompanyModal.createContractorTitle')).toBeInTheDocument();
    expect(screen.getByText('addCompanyModal.createContractorSubtitle')).toBeInTheDocument();
  });

  it('renders company name field', () => {
    render(<AddContractorCompanyModal onClose={onClose} onSuccess={onSuccess} />);
    expect(screen.getByText('addCompanyModal.companyName')).toBeInTheDocument();
  });

  it('renders cancel and create buttons', () => {
    render(<AddContractorCompanyModal onClose={onClose} onSuccess={onSuccess} />);
    expect(screen.getByText('common:cancel')).toBeInTheDocument();
    expect(screen.getByText('addCompanyModal.create')).toBeInTheDocument();
  });

  it('calls onClose when cancel button is clicked', () => {
    render(<AddContractorCompanyModal onClose={onClose} onSuccess={onSuccess} />);
    fireEvent.click(screen.getByText('common:cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('does not call mutate when company name is empty on submit', () => {
    render(<AddContractorCompanyModal onClose={onClose} onSuccess={onSuccess} />);
    fireEvent.submit(screen.getByTestId('input').closest('form')!);
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('calls mutate with company name on submit', () => {
    render(<AddContractorCompanyModal onClose={onClose} onSuccess={onSuccess} />);
    fireEvent.change(screen.getByTestId('input'), { target: { value: 'New Contractor' } });
    fireEvent.submit(screen.getByTestId('input').closest('form')!);
    expect(mockMutate).toHaveBeenCalledWith(
      { type: 'CONTRACTOR', legalName: 'New Contractor' },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('calls onSuccess and onClose callbacks on mutation success', () => {
    render(<AddContractorCompanyModal onClose={onClose} onSuccess={onSuccess} />);
    fireEvent.change(screen.getByTestId('input'), { target: { value: 'Test Co' } });
    fireEvent.submit(screen.getByTestId('input').closest('form')!);
    const mutateCall = mockMutate.mock.calls[0];
    const successCb = mutateCall[1].onSuccess;
    const fakeData = { id: 'c1', legalName: 'Test Co' };
    successCb(fakeData);
    expect(onSuccess).toHaveBeenCalledWith(fakeData);
    expect(onClose).toHaveBeenCalled();
  });

  it('shows error alert when mutation fails', () => {
    mockUseCreateCompany.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      isError: true,
      error: { response: { data: { error: 'Duplicate name' } } },
    });
    render(<AddContractorCompanyModal onClose={onClose} onSuccess={onSuccess} />);
    expect(screen.getByTestId('alert')).toBeInTheDocument();
    expect(screen.getByText('Duplicate name')).toBeInTheDocument();
  });

  it('shows generic error when no response error message', () => {
    mockUseCreateCompany.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      isError: true,
      error: {},
    });
    render(<AddContractorCompanyModal onClose={onClose} onSuccess={onSuccess} />);
    expect(screen.getByText('addCompanyModal.createError')).toBeInTheDocument();
  });

  it('shows loading state when mutation is pending', () => {
    mockUseCreateCompany.mockReturnValue({
      mutate: mockMutate,
      isPending: true,
      isError: false,
      error: null,
    });
    render(<AddContractorCompanyModal onClose={onClose} onSuccess={onSuccess} />);
    expect(screen.getByText('addCompanyModal.creating')).toBeInTheDocument();
  });

  it('submit button is disabled when company name is empty', () => {
    render(<AddContractorCompanyModal onClose={onClose} onSuccess={onSuccess} />);
    const submitBtn = screen.getByText('addCompanyModal.create');
    expect(submitBtn).toBeDisabled();
  });

  it('submit button is enabled when company name is filled', () => {
    render(<AddContractorCompanyModal onClose={onClose} onSuccess={onSuccess} />);
    fireEvent.change(screen.getByTestId('input'), { target: { value: 'Company' } });
    const submitBtn = screen.getByText('addCompanyModal.create');
    expect(submitBtn).not.toBeDisabled();
  });
});
