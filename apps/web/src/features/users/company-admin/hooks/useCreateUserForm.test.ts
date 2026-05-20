const mockAuthStore = vi.hoisted(() => vi.fn());
const mockUsersStore = vi.hoisted(() => vi.fn());
const mockMutate = vi.hoisted(() => vi.fn());
const mockCreateMutation = vi.hoisted(() => ({
  mutate: mockMutate,
  isPending: false,
  isError: false,
  error: null as any,
}));

const mockHandleSubmit = vi.hoisted(() =>
  vi.fn((cb: any) => {
    // Return a function that when called, invokes cb with form data
    return (e?: any) => {
      if (e?.preventDefault) e.preventDefault();
      return cb({ name: 'Test', email: 'test@test.com', role: 'Member', phone: '' });
    };
  }),
);

const mockForm = vi.hoisted(() => ({
  handleSubmit: mockHandleSubmit,
  register: vi.fn(),
  control: {},
  formState: { errors: {} },
}));

vi.mock('@hookform/resolvers/zod', () => ({
  zodResolver: () => () => ({ values: {}, errors: {} }),
}));

vi.mock('react-hook-form', () => ({
  useForm: vi.fn(() => mockForm),
}));

vi.mock('@/features/auth/state/auth.store', () => ({
  useAuthStore: mockAuthStore,
}));

vi.mock('../state/users.store', () => ({
  useUsersStore: mockUsersStore,
}));

vi.mock('../services/users.service', () => ({
  useCreateUser: vi.fn(() => mockCreateMutation),
}));

import { renderHook, act } from '@testing-library/react';

import { useCreateUserForm } from './useCreateUserForm';

describe('useCreateUserForm', () => {
  const mockOnClose = vi.fn();
  const mockOpenSuccessModal = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthStore.mockReturnValue('company-1');
    mockUsersStore.mockReturnValue(mockOpenSuccessModal);
    mockCreateMutation.error = null;
    mockCreateMutation.isError = false;
  });

  it('returns form, handleSubmit, createMutation, and isEmailInUseError', () => {
    const { result } = renderHook(() => useCreateUserForm(mockOnClose));
    expect(result.current.form).toBeDefined();
    expect(result.current.handleSubmit).toBeDefined();
    expect(result.current.createMutation).toBeDefined();
    expect(typeof result.current.isEmailInUseError).toBe('boolean');
  });

  it('returns isEmailInUseError as false when no error', () => {
    const { result } = renderHook(() => useCreateUserForm(mockOnClose));
    expect(result.current.isEmailInUseError).toBe(false);
  });

  it('returns isEmailInUseError as true when error contains email', () => {
    mockCreateMutation.error = { message: 'Email already in use' };
    mockCreateMutation.isError = true;
    const { result } = renderHook(() => useCreateUserForm(mockOnClose));
    expect(result.current.isEmailInUseError).toBe(true);
  });

  it('handleSubmit calls mutate with companyId when invoked', async () => {
    const { result } = renderHook(() => useCreateUserForm(mockOnClose));
    await act(() => result.current.handleSubmit());
    expect(mockMutate).toHaveBeenCalledWith(
      { name: 'Test', email: 'test@test.com', role: 'Member', phone: '', companyId: 'company-1' },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );
  });

  it('handleSubmit does not call mutate when companyId is falsy', async () => {
    mockAuthStore.mockReturnValue(undefined);
    const { result } = renderHook(() => useCreateUserForm(mockOnClose));
    await act(() => result.current.handleSubmit());
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('onSuccess calls onClose and openSuccessModal', async () => {
    const { result } = renderHook(() => useCreateUserForm(mockOnClose));
    await act(() => result.current.handleSubmit());
    const onSuccess = mockMutate.mock.calls[0][1].onSuccess;
    onSuccess();
    expect(mockOnClose).toHaveBeenCalled();
    expect(mockOpenSuccessModal).toHaveBeenCalledWith('test@test.com');
  });

  it('passes createMutation from useCreateUser', () => {
    const { result } = renderHook(() => useCreateUserForm(mockOnClose));
    expect(result.current.createMutation).toBe(mockCreateMutation);
  });
});
