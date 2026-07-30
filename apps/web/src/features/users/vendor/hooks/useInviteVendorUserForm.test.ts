import { renderHook, act } from '@testing-library/react';

const mockMutate = vi.fn();
const mockOpenSuccessModal = vi.fn();
const mockOpenUserExistsModal = vi.fn();

vi.mock('../services/vendor-users.service', () => ({
  useInviteVendorUser: () => ({ mutate: mockMutate, isPending: false }),
}));

vi.mock('../state/vendor-users.store', () => ({
  useVendorUsersStore: (selector: (s: any) => any) =>
    selector({
      openSuccessModal: mockOpenSuccessModal,
      openUserExistsModal: mockOpenUserExistsModal,
    }),
}));

import { useInviteVendorUserForm } from './useInviteVendorUserForm';

describe('useInviteVendorUserForm', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns form, handleSubmit and inviteMutation', () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useInviteVendorUserForm(onClose));
    expect(result.current.form).toBeDefined();
    expect(result.current.handleSubmit).toBeDefined();
    expect(result.current.inviteMutation).toBeDefined();
  });

  it('calls mutate with form data on valid submit', async () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useInviteVendorUserForm(onClose));

    act(() => {
      result.current.form.setValue('name', 'Test User');
      result.current.form.setValue('email', 'test@example.com');
      result.current.form.setValue('position', 'Dev');
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(mockMutate).toHaveBeenCalledWith(
      { name: 'Test User', email: 'test@example.com', position: 'Dev' },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );
  });

  it('calls onClose and openSuccessModal on success', async () => {
    mockMutate.mockImplementation((_data: any, opts: any) => opts.onSuccess());
    const onClose = vi.fn();
    const { result } = renderHook(() => useInviteVendorUserForm(onClose));

    act(() => {
      result.current.form.setValue('name', 'Test');
      result.current.form.setValue('email', 'test@e.com');
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(onClose).toHaveBeenCalled();
    expect(mockOpenSuccessModal).toHaveBeenCalledWith('test@e.com');
  });

  it('sets showUserExists on 409 error', async () => {
    mockMutate.mockImplementation((_data: any, opts: any) => opts.onError({ statusCode: 409 }));
    const onClose = vi.fn();
    const { result } = renderHook(() => useInviteVendorUserForm(onClose));

    act(() => {
      result.current.form.setValue('name', 'Test');
      result.current.form.setValue('email', 'test@e.com');
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(result.current.showUserExists).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('surfaces non-409 errors via showError instead of swallowing them (FOR-289)', async () => {
    mockMutate.mockImplementation((_data: any, opts: any) => opts.onError({ statusCode: 500 }));
    const onClose = vi.fn();
    const { result } = renderHook(() => useInviteVendorUserForm(onClose));

    act(() => {
      result.current.form.setValue('name', 'Test');
      result.current.form.setValue('email', 'test@e.com');
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(result.current.showUserExists).toBe(false);
    expect(result.current.showError).toBe(true);
  });

  it('omits position when not provided — the API rejects an empty string (FOR-289)', async () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useInviteVendorUserForm(onClose));

    act(() => {
      result.current.form.setValue('name', 'Test');
      result.current.form.setValue('email', 'test@e.com');
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(mockMutate).toHaveBeenCalledWith(
      { name: 'Test', email: 'test@e.com', position: undefined },
      expect.anything(),
    );
  });

  it('omits a whitespace-only position', async () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useInviteVendorUserForm(onClose));

    act(() => {
      result.current.form.setValue('name', 'Test');
      result.current.form.setValue('email', 'test@e.com');
      result.current.form.setValue('position', '   ');
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ position: undefined }),
      expect.anything(),
    );
  });
});
