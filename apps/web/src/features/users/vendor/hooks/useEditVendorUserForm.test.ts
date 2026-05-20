const mockReset = vi.hoisted(() => vi.fn());
const mockHandleSubmit = vi.hoisted(() =>
  vi.fn((fn: any) => (e?: any) => {
    e?.preventDefault?.();
    return fn({
      name: 'Updated Name',
      email: 'test@test.com',
      phone: '+123',
      position: 'Dev',
    });
  }),
);
const mockUpdateMutate = vi.hoisted(() => vi.fn());
const mockNotificationSuccess = vi.hoisted(() => vi.fn());

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/ui-components', () => ({
  notificationService: { success: mockNotificationSuccess },
}));

vi.mock('@hookform/resolvers/zod', () => ({
  zodResolver: () => vi.fn(),
}));

vi.mock('react-hook-form', () => ({
  useForm: () => ({
    register: vi.fn(),
    formState: { errors: {} },
    handleSubmit: mockHandleSubmit,
    reset: mockReset,
  }),
}));

vi.mock('../schemas/edit-form.schema', () => ({
  editVendorUserFormSchema: {},
}));

const mockUser = vi.hoisted(() => ({
  value: null as any,
  isLoading: false,
}));

vi.mock('../services/vendor-users.service', () => ({
  useVendorUser: () => ({ data: mockUser.value, isLoading: mockUser.isLoading }),
  useUpdateVendorUser: () => ({ mutate: mockUpdateMutate, isPending: false }),
}));

vi.mock('../state/vendor-users.store', () => ({
  useVendorUsersStore: (selector: (s: any) => any) => selector({ editUserId: 'user-1' }),
}));

import { renderHook, waitFor, act } from '@testing-library/react';

import { useEditVendorUserForm } from './useEditVendorUserForm';

describe('useEditVendorUserForm', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUser.value = null;
    mockUser.isLoading = false;
  });

  it('returns form, handleSubmit, updateMutation, and isLoadingUser', () => {
    const { result } = renderHook(() => useEditVendorUserForm(onClose));
    expect(result.current.form).toBeDefined();
    expect(result.current.handleSubmit).toBeDefined();
    expect(result.current.updateMutation).toBeDefined();
    expect(result.current.isLoadingUser).toBe(false);
  });

  it('resets form when user data loads', async () => {
    mockUser.value = {
      name: 'Alice',
      email: 'alice@test.com',
      phone: '+111',
      position: 'Manager',
    };
    renderHook(() => useEditVendorUserForm(onClose));
    await waitFor(() => {
      expect(mockReset).toHaveBeenCalledWith({
        name: 'Alice',
        email: 'alice@test.com',
        phone: '+111',
        position: 'Manager',
      });
    });
  });

  it('resets form with empty strings for null phone/position', async () => {
    mockUser.value = {
      name: 'Bob',
      email: 'bob@test.com',
      phone: null,
      position: null,
    };
    renderHook(() => useEditVendorUserForm(onClose));
    await waitFor(() => {
      expect(mockReset).toHaveBeenCalledWith({
        name: 'Bob',
        email: 'bob@test.com',
        phone: '',
        position: '',
      });
    });
  });

  it('calls updateMutation.mutate on submit', () => {
    const { result } = renderHook(() => useEditVendorUserForm(onClose));
    act(() => {
      void result.current.handleSubmit();
    });
    expect(mockUpdateMutate).toHaveBeenCalledWith(
      {
        id: 'user-1',
        dto: {
          name: 'Updated Name',
          position: 'Dev',
          phone: '+123',
        },
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });
});
