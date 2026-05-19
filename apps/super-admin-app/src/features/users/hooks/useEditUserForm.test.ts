import { renderHook } from '@testing-library/react';

// Mock i18n
vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// Mock ui-components
vi.mock('@forethread/ui-components', () => ({
  notificationService: { success: vi.fn(), error: vi.fn() },
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
}));

// Mock hookform resolver
vi.mock('@hookform/resolvers/zod', () => ({
  zodResolver: () => vi.fn(),
}));

// Mock users service
const mockUseUser = vi.fn();
const mockUseUpdateUser = vi.fn();
vi.mock('../services/users.service', () => ({
  useUser: (...args: unknown[]) => mockUseUser(...args),
  useUpdateUser: () => mockUseUpdateUser(),
}));

// Mock users store
vi.mock('../state/users.store', () => ({
  useUsersStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ editUserId: 'u1' }),
}));

// Mock react-hook-form
const mockReset = vi.fn();
const mockHandleSubmit = vi.fn().mockImplementation((fn: unknown) => fn);
vi.mock('react-hook-form', () => ({
  useForm: () => ({
    register: () => ({}),
    handleSubmit: mockHandleSubmit,
    formState: { errors: {} },
    reset: mockReset,
    watch: vi.fn(),
    setValue: vi.fn(),
    getValues: vi.fn(),
    trigger: vi.fn(),
    control: {},
  }),
}));

import { useEditUserForm } from './useEditUserForm';

describe('useEditUserForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUser.mockReturnValue({ data: undefined, isLoading: false });
    mockUseUpdateUser.mockReturnValue({ mutate: vi.fn(), isPending: false });
  });

  it('returns expected shape', () => {
    const { result } = renderHook(() => useEditUserForm(vi.fn()));
    expect(result.current).toHaveProperty('form');
    expect(result.current).toHaveProperty('handleSubmit');
    expect(result.current).toHaveProperty('updateMutation');
    expect(result.current).toHaveProperty('isLoadingUser');
    expect(result.current).toHaveProperty('user');
  });

  it('calls useUser with editUserId from store', () => {
    renderHook(() => useEditUserForm(vi.fn()));
    expect(mockUseUser).toHaveBeenCalledWith('u1');
  });

  it('returns isLoadingUser from useUser', () => {
    mockUseUser.mockReturnValue({ data: undefined, isLoading: true });
    const { result } = renderHook(() => useEditUserForm(vi.fn()));
    expect(result.current.isLoadingUser).toBe(true);
  });

  it('returns user data from useUser', () => {
    const userData = {
      id: 'u1',
      name: 'John',
      email: 'john@test.com',
      role: 'COMPANY_ADMIN',
      phone: null,
      position: null,
    };
    mockUseUser.mockReturnValue({ data: userData, isLoading: false });
    const { result } = renderHook(() => useEditUserForm(vi.fn()));
    expect(result.current.user).toEqual(userData);
  });

  it('returns updateMutation from useUpdateUser', () => {
    const mockMutate = vi.fn();
    mockUseUpdateUser.mockReturnValue({ mutate: mockMutate, isPending: false });
    const { result } = renderHook(() => useEditUserForm(vi.fn()));
    expect(result.current.updateMutation).toHaveProperty('mutate');
  });
});
