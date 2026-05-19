import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockOnClose = vi.fn();
const mockMutate = vi.fn();
let mockProfileReturn = {
  data: null as Record<string, unknown> | null,
};
let mockUpdateReturn = {
  mutate: mockMutate,
  isPending: false,
  isError: false,
};

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/ui-components', () => ({
  Modal: ({ children, onClose }: { children: React.ReactNode; onClose: () => void }) => (
    <div data-testid="modal">
      {children}
      <button data-testid="modal-backdrop" onClick={onClose}>
        backdrop
      </button>
    </div>
  ),
  ModalBody: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="modal-body">{children}</div>
  ),
  ModalCloseButton: ({ onClose }: { onClose: () => void }) => (
    <button data-testid="modal-close" onClick={onClose}>
      X
    </button>
  ),
  Input: ({ placeholder, ...rest }: Record<string, unknown>) => (
    <input
      data-testid={`input-${String(rest.name ?? placeholder)}`}
      placeholder={placeholder as string}
      {...rest}
    />
  ),
  FormField: ({
    children,
    label,
    error,
  }: {
    children: React.ReactNode;
    label: string;
    error?: string;
  }) => (
    <div data-testid={`field-${label}`}>
      <label>{label}</label>
      {children}
      {error && <span data-testid="field-error">{error}</span>}
    </div>
  ),
  Button: ({ children, onClick, type, isLoading }: Record<string, unknown>) => (
    <button
      data-testid={`btn-${typeof type === 'string' ? type : 'button'}`}
      onClick={onClick as () => void}
      type={type as 'submit' | 'button'}
    >
      {isLoading ? 'loading' : (children as React.ReactNode)}
    </button>
  ),
  Alert: ({ children }: { children: React.ReactNode }) => <div data-testid="alert">{children}</div>,
  IconBadge: ({ icon }: { icon: React.ReactNode }) => <div>{icon}</div>,
  CustomDropdown: ({ value, onChange, placeholder }: Record<string, unknown>) => (
    <select
      data-testid="dropdown"
      value={value as string}
      onChange={(e) => (onChange as (v: string) => void)(e.target.value)}
    >
      <option value="">{placeholder as string}</option>
      <option value="available">available</option>
      <option value="unavailable">unavailable</option>
    </select>
  ),
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
}));

vi.mock('@forethread/ui-components/assets/icons/briefcase.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/department.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/edit-without-line.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/id-badge.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/phone.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/user-outline.svg?react', () => ({
  default: () => <div />,
}));

vi.mock('@hookform/resolvers/zod', () => ({
  zodResolver: () => vi.fn(),
}));

const mockReset = vi.fn();
let mockFormErrors: Record<string, { message: string }> = {};
vi.mock('react-hook-form', () => ({
  useForm: () => ({
    register: vi.fn((name: string) => ({ name })),
    handleSubmit: vi.fn(
      (cb: (data: Record<string, unknown>) => void) => (e?: { preventDefault?: () => void }) => {
        e?.preventDefault?.();
        return cb({
          name: 'Updated Name',
          phone: '123',
          workStatus: 'available',
          position: 'Dev',
          department: 'IT',
        });
      },
    ),
    reset: mockReset,
    control: {},
    formState: { errors: mockFormErrors },
  }),
  Controller: ({
    render: renderProp,
  }: {
    render: (args: { field: { value: string; onChange: (v: string) => void } }) => React.ReactNode;
  }) => renderProp({ field: { value: 'available', onChange: vi.fn() } }),
}));

vi.mock('../../../../../../packages/profile-shared/src/services/profile.service', () => ({
  useProfile: () => mockProfileReturn,
  useUpdateProfile: () => mockUpdateReturn,
}));

vi.mock('../services/profile.service', () => ({
  useProfile: () => mockProfileReturn,
  useUpdateProfile: () => mockUpdateReturn,
}));

import { EditProfileModal } from './EditProfileModal';

describe('EditProfileModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFormErrors = {};
    mockProfileReturn = {
      data: {
        name: 'John Doe',
        phone: '555-0100',
        workStatus: 'available',
        position: 'Manager',
        department: 'Ops',
      },
    };
    mockUpdateReturn = {
      mutate: mockMutate,
      isPending: false,
      isError: false,
    };
  });

  it('renders modal with title and subtitle', () => {
    render(<EditProfileModal onClose={mockOnClose} />);
    expect(screen.getByText('editModal.title')).toBeInTheDocument();
    expect(screen.getByText('editModal.subtitle')).toBeInTheDocument();
  });

  it('calls reset with profile data when profile loaded', () => {
    render(<EditProfileModal onClose={mockOnClose} />);
    expect(mockReset).toHaveBeenCalledWith({
      name: 'John Doe',
      phone: '555-0100',
      workStatus: 'available',
      position: 'Manager',
      department: 'Ops',
    });
  });

  it('calls onClose when close button clicked', () => {
    render(<EditProfileModal onClose={mockOnClose} />);
    fireEvent.click(screen.getByTestId('modal-close'));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls onClose when cancel button clicked', () => {
    render(<EditProfileModal onClose={mockOnClose} />);
    fireEvent.click(screen.getByText('common:cancel'));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('submits form data via mutate', () => {
    render(<EditProfileModal onClose={mockOnClose} />);
    fireEvent.click(screen.getByTestId('btn-submit'));
    expect(mockMutate).toHaveBeenCalled();
  });

  it('shows error alert when update fails', () => {
    mockUpdateReturn.isError = true;
    render(<EditProfileModal onClose={mockOnClose} />);
    expect(screen.getByTestId('alert')).toBeInTheDocument();
    expect(screen.getByText('editModal.updateError')).toBeInTheDocument();
  });

  it('shows submitting label when pending', () => {
    mockUpdateReturn.isPending = true;
    render(<EditProfileModal onClose={mockOnClose} />);
    expect(screen.getByText('loading')).toBeInTheDocument();
  });

  it('does not call reset when no profile data', () => {
    mockProfileReturn.data = null;
    render(<EditProfileModal onClose={mockOnClose} />);
    expect(mockReset).not.toHaveBeenCalled();
  });

  it('renders form field errors when present', () => {
    mockFormErrors = { name: { message: 'Name is required' } };
    render(<EditProfileModal onClose={mockOnClose} />);
    expect(screen.getByText('Name is required')).toBeInTheDocument();
  });

  it('resets profile with null fields as empty strings', () => {
    mockProfileReturn.data = {
      name: 'Jane',
      phone: null,
      workStatus: null,
      position: null,
      department: null,
    };
    render(<EditProfileModal onClose={mockOnClose} />);
    expect(mockReset).toHaveBeenCalledWith({
      name: 'Jane',
      phone: '',
      workStatus: '',
      position: '',
      department: '',
    });
  });

  it('closes modal via backdrop', () => {
    render(<EditProfileModal onClose={mockOnClose} />);
    fireEvent.click(screen.getByTestId('modal-backdrop'));
    expect(mockOnClose).toHaveBeenCalled();
  });
});
