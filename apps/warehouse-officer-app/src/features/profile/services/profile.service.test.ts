import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { type ReactNode, createElement } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetMe = vi.fn();
const mockUpdateMe = vi.fn();
const mockChangePassword = vi.fn();
const mockUploadMyAvatar = vi.fn();
const mockGetMyAvatarUrl = vi.fn();

vi.mock('@forethread/api-client', () => ({
  getMe: () => mockGetMe(),
  updateMe: (dto: unknown) => mockUpdateMe(dto),
  changePassword: (dto: unknown) => mockChangePassword(dto),
  uploadMyAvatar: (file: unknown) => mockUploadMyAvatar(file),
  getMyAvatarUrl: () => mockGetMyAvatarUrl(),
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
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
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

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.data).toEqual(mockData);
    });
  });

  describe('useUpdateProfile', () => {
    it('calls updateMe and invalidates profile cache', async () => {
      mockUpdateMe.mockResolvedValue({});
      mockGetMe.mockResolvedValue({ id: '1', name: 'Updated' });

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

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.data).toBe('https://example.com/avatar.jpg');
    });
  });

  describe('useUploadAvatar', () => {
    it('uploads avatar and invalidates caches', async () => {
      mockUploadMyAvatar.mockResolvedValue({});
      mockGetMe.mockResolvedValue({});
      mockGetMyAvatarUrl.mockResolvedValue({ url: 'new-url' });

      const file = new File([], 'avatar.jpg');
      const { result } = renderHook(() => useUploadAvatar(), { wrapper: createWrapper() });

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
