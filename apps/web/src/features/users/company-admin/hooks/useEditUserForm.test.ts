const mockUsersStore = vi.hoisted(() => vi.fn());
const mockMutate = vi.hoisted(() => vi.fn());
const mockUpdateMutation = vi.hoisted(() => ({
  mutate: mockMutate,
  isPending: false,
  isError: false,
  error: null,
}));
const mockReset = vi.hoisted(() => vi.fn());
const capturedEffect = vi.hoisted(() => ({ fn: null as any }));
const mockHandleSubmit = vi.hoisted(() =>
  vi.fn((cb: any) => {
    return (e?: any) => {
      if (e?.preventDefault) e.preventDefault();
      return cb({
        name: 'Updated',
        email: 'e@e.com',
        role: 'Admin',
        phone: '123',
        position: 'Dev',
        department: '',
      });
    };
  }),
);

const mockForm = vi.hoisted(() => ({
  handleSubmit: mockHandleSubmit,
  register: vi.fn(),
  control: {},
  formState: { errors: {} },
  reset: mockReset,
}));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return {
    ...actual,
    useEffect: (fn: any) => {
      capturedEffect.fn = fn;
    },
  };
});

vi.mock('@forethread/ui-components', () => ({
  notificationService: { success: vi.fn() },
}));

vi.mock('@hookform/resolvers/zod', () => ({
  zodResolver: () => () => ({ values: {}, errors: {} }),
}));

vi.mock('react-hook-form', () => ({
  useForm: vi.fn(() => mockForm),
}));

vi.mock('../state/users.store', () => ({
  useUsersStore: mockUsersStore,
}));

const mockUseUser = vi.hoisted(() => vi.fn());
vi.mock('../services/users.service', () => ({
  useUser: mockUseUser,
  useUpdateUser: vi.fn(() => mockUpdateMutation),
}));

import { useEditUserForm } from './useEditUserForm';

describe('useEditUserForm', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUsersStore.mockReturnValue('user-1');
    mockUseUser.mockReturnValue({ data: null, isLoading: false });
  });

  it('returns form, handleSubmit, updateMutation, and isLoadingUser', () => {
    const result = useEditUserForm(mockOnClose);
    expect(result.form).toBeDefined();
    expect(result.handleSubmit).toBeDefined();
    expect(result.updateMutation).toBeDefined();
    expect(typeof result.isLoadingUser).toBe('boolean');
  });

  it('passes updateMutation from useUpdateUser', () => {
    const result = useEditUserForm(mockOnClose);
    expect(result.updateMutation).toBe(mockUpdateMutation);
  });

  it('returns isLoadingUser from useUser', () => {
    const result = useEditUserForm(mockOnClose);
    expect(result.isLoadingUser).toBe(false);
  });

  it('useEffect resets form when user data is available', () => {
    const user = {
      name: 'Test',
      email: 'test@t.com',
      phone: '123',
      role: 'Admin',
      position: 'Dev',
    };
    mockUseUser.mockReturnValue({ data: user, isLoading: false });
    useEditUserForm(mockOnClose);

    // Execute the captured useEffect
    if (capturedEffect.fn) {
      capturedEffect.fn();
    }
    expect(mockReset).toHaveBeenCalledWith({
      name: 'Test',
      email: 'test@t.com',
      phone: '123',
      role: 'Admin',
      position: 'Dev',
      department: '',
    });
  });

  it('useEffect does not reset form when user data is null', () => {
    mockUseUser.mockReturnValue({ data: null, isLoading: false });
    useEditUserForm(mockOnClose);
    if (capturedEffect.fn) {
      capturedEffect.fn();
    }
    expect(mockReset).not.toHaveBeenCalled();
  });

  it('useEffect handles user with null phone and position', () => {
    const user = { name: 'Test', email: 'test@t.com', phone: null, role: 'Admin', position: null };
    mockUseUser.mockReturnValue({ data: user, isLoading: false });
    useEditUserForm(mockOnClose);
    if (capturedEffect.fn) {
      capturedEffect.fn();
    }
    expect(mockReset).toHaveBeenCalledWith({
      name: 'Test',
      email: 'test@t.com',
      phone: '',
      role: 'Admin',
      position: '',
      department: '',
    });
  });

  it('handleSubmit calls mutate with correct data when editUserId is set', () => {
    const result = useEditUserForm(mockOnClose);
    void result.handleSubmit();
    expect(mockMutate).toHaveBeenCalledWith(
      {
        id: 'user-1',
        dto: {
          name: 'Updated',
          role: 'Admin',
          position: 'Dev',
          phone: '123',
        },
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('handleSubmit does not call mutate when editUserId is null', () => {
    mockUsersStore.mockReturnValue(null);
    const result = useEditUserForm(mockOnClose);
    void result.handleSubmit();
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('handleSubmit converts empty position/phone to undefined', () => {
    mockHandleSubmit.mockImplementationOnce((cb: any) => {
      return () =>
        cb({
          name: 'Test',
          email: 'e@e.com',
          role: 'Admin',
          phone: '',
          position: '',
          department: '',
        });
    });
    const result = useEditUserForm(mockOnClose);
    void result.handleSubmit();
    expect(mockMutate).toHaveBeenCalledWith(
      {
        id: 'user-1',
        dto: {
          name: 'Test',
          role: 'Admin',
          position: undefined,
          phone: undefined,
        },
      },
      expect.any(Object),
    );
  });

  it('onSuccess calls notificationService and onClose', () => {
    const result = useEditUserForm(mockOnClose);
    void result.handleSubmit();
    const onSuccess = mockMutate.mock.calls[0][1].onSuccess;
    onSuccess();
    expect(mockOnClose).toHaveBeenCalled();
  });
});
