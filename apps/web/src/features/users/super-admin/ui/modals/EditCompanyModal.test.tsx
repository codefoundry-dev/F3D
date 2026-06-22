import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockMutate = vi.fn();
const mockUseUpdateCompany = vi.fn().mockReturnValue({
  mutate: mockMutate,
  isPending: false,
  isError: false,
  error: null,
});

vi.mock('@/features/companies/services/companies.service', () => ({
  useUpdateCompany: () => mockUseUpdateCompany(),
}));

const mockCloseEditCompanyModal = vi.fn();
const mockUseUsersStore = vi.fn().mockReturnValue({
  editCompanyId: 'c1',
  editCompanyName: 'Acme Corp',
  closeEditCompanyModal: mockCloseEditCompanyModal,
});

vi.mock('../../state/users.store', () => ({
  useUsersStore: () => mockUseUsersStore(),
}));

vi.mock('@forethread/ui-components', () => ({
  GridModal: ({ icon, title, description, children, actions, onSubmit }: any) =>
    onSubmit ? (
      <form data-testid="modal" onSubmit={onSubmit}>
        {icon}
        <h2>{title}</h2>
        <p>{description}</p>
        {children}
        {actions}
      </form>
    ) : (
      <div data-testid="modal">
        {icon}
        <h2>{title}</h2>
        <p>{description}</p>
        {children}
        {actions}
      </div>
    ),
  Modal: ({ children }: any) => <div data-testid="modal">{children}</div>,
  ModalBody: ({ children }: any) => <div>{children}</div>,
  ModalCloseButton: ({ onClose }: any) => <button data-testid="close-btn" onClick={onClose} />,
  Button: ({ children, ...p }: any) => <button {...p}>{children}</button>,
  IconBadge: () => <div data-testid="icon-badge" />,
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
vi.mock('@forethread/ui-components/assets/icons/edit-without-line.svg?react', () => ({
  default: (p: any) => <svg {...p} />,
}));

import { EditCompanyModal } from './EditCompanyModal';

describe('EditCompanyModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUpdateCompany.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      isError: false,
      error: null,
    });
    mockUseUsersStore.mockReturnValue({
      editCompanyId: 'c1',
      editCompanyName: 'Acme Corp',
      closeEditCompanyModal: mockCloseEditCompanyModal,
    });
  });

  it('renders the modal with title', () => {
    render(<EditCompanyModal />);
    expect(screen.getByText('editCompanyModal.title')).toBeInTheDocument();
    expect(screen.getByText('editCompanyModal.subtitle')).toBeInTheDocument();
  });

  it('renders company name field', () => {
    render(<EditCompanyModal />);
    expect(screen.getByText('editCompanyModal.companyName')).toBeInTheDocument();
  });

  it('renders submit and cancel buttons', () => {
    render(<EditCompanyModal />);
    expect(screen.getByText('editCompanyModal.submitChanges')).toBeInTheDocument();
    expect(screen.getByText('common:cancel')).toBeInTheDocument();
  });

  it('calls closeEditCompanyModal when cancel button is clicked', () => {
    render(<EditCompanyModal />);
    fireEvent.click(screen.getByText('common:cancel'));
    expect(mockCloseEditCompanyModal).toHaveBeenCalled();
  });

  it('pre-fills company name from store', () => {
    render(<EditCompanyModal />);
    expect(screen.getByTestId('input')).toHaveValue('Acme Corp');
  });

  it('calls mutate with updated company name on submit', () => {
    render(<EditCompanyModal />);
    fireEvent.change(screen.getByTestId('input'), { target: { value: 'Updated Corp' } });
    fireEvent.submit(screen.getByTestId('input').closest('form')!);
    expect(mockMutate).toHaveBeenCalledWith(
      { id: 'c1', dto: { legalName: 'Updated Corp' } },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('does not call mutate when company name is empty', () => {
    render(<EditCompanyModal />);
    fireEvent.change(screen.getByTestId('input'), { target: { value: '' } });
    fireEvent.submit(screen.getByTestId('input').closest('form')!);
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('does not call mutate when editCompanyId is null', () => {
    mockUseUsersStore.mockReturnValue({
      editCompanyId: null,
      editCompanyName: 'Acme Corp',
      closeEditCompanyModal: mockCloseEditCompanyModal,
    });
    render(<EditCompanyModal />);
    fireEvent.submit(screen.getByTestId('input').closest('form')!);
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('calls closeEditCompanyModal on mutation success', () => {
    render(<EditCompanyModal />);
    fireEvent.change(screen.getByTestId('input'), { target: { value: 'Updated Corp' } });
    fireEvent.submit(screen.getByTestId('input').closest('form')!);
    const mutateCall = mockMutate.mock.calls[0];
    mutateCall[1].onSuccess();
    expect(mockCloseEditCompanyModal).toHaveBeenCalled();
  });

  it('shows error alert when mutation fails', () => {
    mockUseUpdateCompany.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      isError: true,
      error: { response: { data: { error: 'Update failed' } } },
    });
    render(<EditCompanyModal />);
    expect(screen.getByTestId('alert')).toBeInTheDocument();
    expect(screen.getByText('Update failed')).toBeInTheDocument();
  });

  it('shows generic error when no response error message', () => {
    mockUseUpdateCompany.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      isError: true,
      error: {},
    });
    render(<EditCompanyModal />);
    expect(screen.getByText('editCompanyModal.updateError')).toBeInTheDocument();
  });

  it('shows loading state when mutation is pending', () => {
    mockUseUpdateCompany.mockReturnValue({
      mutate: mockMutate,
      isPending: true,
      isError: false,
      error: null,
    });
    render(<EditCompanyModal />);
    expect(screen.getByText('editCompanyModal.submitting')).toBeInTheDocument();
  });

  it('submit button is disabled when company name is empty', () => {
    render(<EditCompanyModal />);
    fireEvent.change(screen.getByTestId('input'), { target: { value: '' } });
    const submitBtn = screen.getByText('editCompanyModal.submitChanges');
    expect(submitBtn).toBeDisabled();
  });
});
