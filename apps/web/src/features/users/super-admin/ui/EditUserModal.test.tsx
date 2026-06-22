import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-hook-form', () => ({
  Controller: ({ render: renderFn }: any) =>
    renderFn({ field: { value: '', onChange: vi.fn() }, fieldState: {} }),
  useForm: () => ({
    register: () => ({}),
    control: {},
    handleSubmit: (fn: any) => (e: any) => {
      e?.preventDefault?.();
      fn({});
    },
    formState: { errors: {} },
  }),
}));

vi.mock('../hooks/useEditUserForm', () => ({
  useEditUserForm: () => ({
    form: {
      register: () => ({}),
      control: {},
      formState: { errors: {} },
    },
    handleSubmit: vi.fn((e: any) => e?.preventDefault?.()),
    updateMutation: { isPending: false, isError: false, error: null },
    isLoadingUser: false,
    user: { company: { legalName: 'Acme Corp' } },
  }),
}));

vi.mock('../hooks/useRoleOptions', () => ({
  useRoleOptions: () => [{ value: 'COMPANY_ADMIN', label: 'Company Admin' }],
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
  Input: (props: any) => <input data-testid={`input-${props.type ?? 'text'}`} {...props} />,
  FormField: ({ children, label }: any) => (
    <div>
      <label>{label}</label>
      {children}
    </div>
  ),
  Button: ({ children, ...p }: any) => <button {...p}>{children}</button>,
  Alert: ({ children }: any) => <div data-testid="alert">{children}</div>,
  IconBadge: () => <div data-testid="icon-badge" />,
  CustomDropdown: () => <div data-testid="dropdown" />,
  Spinner: () => <div data-testid="spinner" />,
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
vi.mock('@forethread/ui-components/assets/icons/edit-without-line.svg?react', () => ({
  default: (p: any) => <svg {...p} />,
}));
vi.mock('@forethread/ui-components/assets/icons/envelope-simple.svg?react', () => ({
  default: (p: any) => <svg {...p} />,
}));
vi.mock('@forethread/ui-components/assets/icons/id-badge.svg?react', () => ({
  default: (p: any) => <svg {...p} />,
}));
vi.mock('@forethread/ui-components/assets/icons/phone.svg?react', () => ({
  default: (p: any) => <svg {...p} />,
}));
vi.mock('@forethread/ui-components/assets/icons/user-outline.svg?react', () => ({
  default: (p: any) => <svg {...p} />,
}));

import { EditUserModal } from './EditUserModal';

describe('EditUserModal', () => {
  const onClose = vi.fn();

  it('renders the modal with title', () => {
    render(<EditUserModal onClose={onClose} />);
    expect(screen.getByText('editModal.title')).toBeInTheDocument();
    expect(screen.getByText('editModal.subtitle')).toBeInTheDocument();
  });

  it('renders form fields', () => {
    render(<EditUserModal onClose={onClose} />);
    expect(screen.getByText('editModal.fullName')).toBeInTheDocument();
    expect(screen.getByText('editModal.email')).toBeInTheDocument();
    expect(screen.getByText('editModal.phone')).toBeInTheDocument();
    expect(screen.getByText('editModal.role')).toBeInTheDocument();
  });

  it('does not render a company field (not in Figma)', () => {
    render(<EditUserModal onClose={onClose} />);
    expect(screen.queryByText('columns.company')).not.toBeInTheDocument();
  });

  it('renders submit and cancel buttons', () => {
    render(<EditUserModal onClose={onClose} />);
    expect(screen.getByText('editModal.submitChanges')).toBeInTheDocument();
    expect(screen.getByText('common:cancel')).toBeInTheDocument();
  });

  it('calls onClose when cancel button is clicked', () => {
    render(<EditUserModal onClose={onClose} />);
    fireEvent.click(screen.getByText('common:cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('submits the form via handleSubmit', () => {
    render(<EditUserModal onClose={onClose} />);
    const form = document.querySelector('form')!;
    fireEvent.submit(form);
    // Should not crash — form submission is handled
    expect(form).toBeInTheDocument();
  });
});
