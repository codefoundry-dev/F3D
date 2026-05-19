import { render, screen, fireEvent } from '@testing-library/react';

// Mock SVG icons
vi.mock('@forethread/ui-components/assets/icons/edit-without-line.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/user-outline.svg?react', () => ({
  default: () => <div />,
}));

// Mock i18n
vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// Mock ui-components
vi.mock('@forethread/ui-components', () => ({
  Modal: ({ children }: React.PropsWithChildren) => <div data-testid="modal">{children}</div>,
  ModalBody: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  ModalCloseButton: ({ onClose }: { onClose: () => void }) => (
    <button data-testid="close-btn" onClick={onClose} />
  ),
  Input: (props: Record<string, unknown>) => <input data-testid="input" {...props} />,
  FormField: ({ children, label }: React.PropsWithChildren<{ label: string }>) => (
    <div>
      <label>{label}</label>
      {children}
    </div>
  ),
  Button: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <button {...props}>{children}</button>
  ),
  Alert: ({ children }: React.PropsWithChildren) => <div data-testid="alert">{children}</div>,
  IconBadge: ({ icon }: { icon: React.ReactNode }) => <div>{icon}</div>,
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
}));

// Mock hookform resolver
vi.mock('@hookform/resolvers/zod', () => ({
  zodResolver: () => vi.fn(),
}));

// Mock tanstack query — capture useMutation config to test callbacks
let capturedMutationConfig: any = {};
const mockMutate = vi.fn();
const mockInvalidateQueries = vi.fn();
vi.mock('@tanstack/react-query', () => ({
  useMutation: (config: any) => {
    capturedMutationConfig = config;
    return { mutate: mockMutate, isPending: false, isError: false };
  },
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

// Mock react-hook-form — handleSubmit actually calls the function
vi.mock('react-hook-form', () => ({
  useForm: () => ({
    register: () => ({}),
    handleSubmit: (fn: (data: any) => void) => (e: Event) => {
      e?.preventDefault?.();
      fn({ legalName: 'Updated Corp' });
    },
    formState: { errors: {} },
  }),
}));

// Mock api-client
vi.mock('@forethread/api-client', () => ({
  updateCompany: vi.fn(),
}));

import { EditCompanyModal } from './EditCompanyModal';

const mockCompany = {
  id: 'c1',
  legalName: 'Acme Corp',
  tradeName: 'Acme',
  abn: '12345678901',
  taxCode: 'TC1',
  legalAddress: '123 Main St',
  contactEmail: 'info@acme.com',
  contactPhone: '+61400000000',
  website: 'https://acme.com',
};

describe('EditCompanyModal', () => {
  it('renders modal with title', () => {
    render(<EditCompanyModal company={mockCompany as never} onClose={vi.fn()} />);
    expect(screen.getByTestId('modal')).toBeInTheDocument();
    expect(screen.getByText('editModal.title')).toBeInTheDocument();
    expect(screen.getByText('editModal.subtitle')).toBeInTheDocument();
  });

  it('renders company name field', () => {
    render(<EditCompanyModal company={mockCompany as never} onClose={vi.fn()} />);
    expect(screen.getByText('companyName')).toBeInTheDocument();
  });

  it('renders submit and cancel buttons', () => {
    render(<EditCompanyModal company={mockCompany as never} onClose={vi.fn()} />);
    expect(screen.getByText('editModal.submit')).toBeInTheDocument();
    expect(screen.getByText('common:cancel')).toBeInTheDocument();
  });

  it('calls onClose when cancel button is clicked', () => {
    const onClose = vi.fn();
    render(<EditCompanyModal company={mockCompany as never} onClose={onClose} />);
    fireEvent.click(screen.getByText('common:cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<EditCompanyModal company={mockCompany as never} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('close-btn'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls mutate with form data on submit', () => {
    render(<EditCompanyModal company={mockCompany as never} onClose={vi.fn()} />);
    const form = document.querySelector('form')!;
    fireEvent.submit(form);
    expect(mockMutate).toHaveBeenCalledWith({ legalName: 'Updated Corp' });
  });

  it('onSuccess invalidates queries and calls onClose', () => {
    const onClose = vi.fn();
    render(<EditCompanyModal company={mockCompany as never} onClose={onClose} />);
    // Invoke the captured onSuccess callback
    capturedMutationConfig.onSuccess();
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['companies'] });
    expect(onClose).toHaveBeenCalled();
  });

  it('mutationFn calls updateCompany with correct args', async () => {
    const { updateCompany } = await import('@forethread/api-client');
    vi.mocked(updateCompany).mockResolvedValue({} as never);
    render(<EditCompanyModal company={mockCompany as never} onClose={vi.fn()} />);
    // Invoke the captured mutationFn
    await capturedMutationConfig.mutationFn({ legalName: 'New Name' });
    expect(updateCompany).toHaveBeenCalledWith('c1', { legalName: 'New Name' });
  });
});
