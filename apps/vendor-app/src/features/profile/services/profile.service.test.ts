import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createElement } from 'react';

const mockGetMe = vi.hoisted(() => vi.fn());
const mockUpdateMe = vi.hoisted(() => vi.fn());
const mockChangePassword = vi.hoisted(() => vi.fn());
const mockUploadMyAvatar = vi.hoisted(() => vi.fn());
const mockGetMyAvatarUrl = vi.hoisted(() => vi.fn());

vi.mock('@forethread/api-client', () => ({
  getMe: mockGetMe,
  updateMe: mockUpdateMe,
  changePassword: mockChangePassword,
  uploadMyAvatar: mockUploadMyAvatar,
  getMyAvatarUrl: mockGetMyAvatarUrl,
}));

import {
  useProfile,
  useUpdateProfile,
  useAvatarUrl,
  useUploadAvatar,
  useChangePassword,
} from './profile.service';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('profile.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useProfile', () => {
    it('fetches profile data', async () => {
      const mockData = { id: '1', name: 'John', email: 'john@test.com' };
      mockGetMe.mockResolvedValue(mockData);

      const { result } = renderHook(() => useProfile(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockData);
    });
  });

  describe('useUpdateProfile', () => {
    it('calls updateMe mutation', async () => {
      mockUpdateMe.mockResolvedValue({});
      const { result } = renderHook(() => useUpdateProfile(), { wrapper: createWrapper() });

      result.current.mutate({ name: 'Updated' });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockUpdateMe).toHaveBeenCalledWith({ name: 'Updated' });
    });
  });

  describe('useAvatarUrl', () => {
    it('fetches and selects avatar url', async () => {
      mockGetMyAvatarUrl.mockResolvedValue({ url: 'https://example.com/avatar.jpg' });

      const { result } = renderHook(() => useAvatarUrl(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toBe('https://example.com/avatar.jpg');
    });
  });

  describe('useUploadAvatar', () => {
    it('calls uploadMyAvatar mutation', async () => {
      mockUploadMyAvatar.mockResolvedValue({});
      const { result } = renderHook(() => useUploadAvatar(), { wrapper: createWrapper() });

      const file = new File(['test'], 'avatar.png', { type: 'image/png' });
      result.current.mutate(file);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockUploadMyAvatar).toHaveBeenCalledWith(file);
    });
  });

  describe('useChangePassword', () => {
    it('calls changePassword mutation', async () => {
      mockChangePassword.mockResolvedValue({});
      const { result } = renderHook(() => useChangePassword(), { wrapper: createWrapper() });

      result.current.mutate({ currentPassword: 'old', newPassword: 'new' });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockChangePassword).toHaveBeenCalledWith({
        currentPassword: 'old',
        newPassword: 'new',
      });
    });
  });
});
