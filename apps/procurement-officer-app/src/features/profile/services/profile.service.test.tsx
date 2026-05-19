vi.mock('@forethread/api-client', () => ({
  getMe: vi.fn(),
  updateMe: vi.fn(),
  changePassword: vi.fn(),
  uploadMyAvatar: vi.fn(),
  getMyAvatarUrl: vi.fn(),
}));

import {
  getMe,
  updateMe,
  changePassword,
  uploadMyAvatar,
  getMyAvatarUrl,
} from '@forethread/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { ReactNode } from 'react';

import {
  useProfile,
  useUpdateProfile,
  useAvatarUrl,
  useUploadAvatar,
  useChangePassword,
} from './profile.service';

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe('profile.service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('useProfile calls getMe', async () => {
    vi.mocked(getMe).mockResolvedValue({ id: '1', name: 'Test' } as never);
    const { result } = renderHook(() => useProfile(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getMe).toHaveBeenCalled();
  });

  it('useAvatarUrl extracts url from response', async () => {
    vi.mocked(getMyAvatarUrl).mockResolvedValue({ url: 'https://example.com/avatar.jpg' } as never);
    const { result } = renderHook(() => useAvatarUrl(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe('https://example.com/avatar.jpg');
  });

  it('useUpdateProfile calls updateMe and invalidates', async () => {
    vi.mocked(updateMe).mockResolvedValue({} as never);
    const { result } = renderHook(() => useUpdateProfile(), { wrapper: createWrapper() });
    act(() => result.current.mutate({ name: 'New Name' } as never));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(updateMe).toHaveBeenCalledWith({ name: 'New Name' });
  });

  it('useUploadAvatar calls uploadMyAvatar', async () => {
    vi.mocked(uploadMyAvatar).mockResolvedValue({} as never);
    const file = new File(['test'], 'avatar.png', { type: 'image/png' });
    const { result } = renderHook(() => useUploadAvatar(), { wrapper: createWrapper() });
    act(() => result.current.mutate(file));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(uploadMyAvatar).toHaveBeenCalledWith(file);
  });

  it('useChangePassword calls changePassword', async () => {
    vi.mocked(changePassword).mockResolvedValue({} as never);
    const dto = { currentPassword: 'old', newPassword: 'new' };
    const { result } = renderHook(() => useChangePassword(), { wrapper: createWrapper() });
    act(() => result.current.mutate(dto as never));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(changePassword).toHaveBeenCalledWith(dto);
  });
});
