import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetMe = vi.fn();
const mockUpdateMe = vi.fn();
const mockChangePassword = vi.fn();
const mockUploadMyAvatar = vi.fn();
const mockGetMyAvatarUrl = vi.fn();

vi.mock('@forethread/api-client', () => ({
  getMe: (...args: unknown[]) => mockGetMe(...args),
  updateMe: (...args: unknown[]) => mockUpdateMe(...args),
  changePassword: (...args: unknown[]) => mockChangePassword(...args),
  uploadMyAvatar: (...args: unknown[]) => mockUploadMyAvatar(...args),
  getMyAvatarUrl: (...args: unknown[]) => mockGetMyAvatarUrl(...args),
}));

const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();
const mockUseQueryClient = vi.fn();
const mockInvalidateQueries = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
  useQueryClient: () => mockUseQueryClient(),
}));

import {
  useProfile,
  useUpdateProfile,
  useAvatarUrl,
  useUploadAvatar,
  useChangePassword,
} from './profile.service';

describe('profile.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQueryClient.mockReturnValue({ invalidateQueries: mockInvalidateQueries });
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false });
    mockUseMutation.mockReturnValue({ mutate: vi.fn(), isPending: false });
  });

  describe('useProfile', () => {
    it('calls useQuery with the correct query key and queryFn', () => {
      useProfile();
      expect(mockUseQuery).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['profile-me'] }),
      );
    });

    it('uses getMe as the queryFn', () => {
      useProfile();
      const config = mockUseQuery.mock.calls[0][0];
      // queryFn is the mocked getMe — invoke it to verify delegation
      config.queryFn();
      expect(mockGetMe).toHaveBeenCalled();
    });
  });

  describe('useUpdateProfile', () => {
    it('calls useMutation with a mutationFn', () => {
      useUpdateProfile();
      expect(mockUseMutation).toHaveBeenCalledTimes(1);
    });

    it('mutationFn delegates to updateMe', () => {
      let capturedFn: (dto: unknown) => unknown = () => {};
      mockUseMutation.mockImplementation((config: any) => {
        capturedFn = config.mutationFn;
        return { mutate: vi.fn() };
      });

      useUpdateProfile();
      const dto = { name: 'Updated' };
      capturedFn(dto);
      expect(mockUpdateMe).toHaveBeenCalledWith(dto);
    });

    it('invalidates profile queries on success', () => {
      let capturedOnSuccess: () => void = () => {};
      mockUseMutation.mockImplementation((config: any) => {
        capturedOnSuccess = config.onSuccess;
        return { mutate: vi.fn() };
      });

      useUpdateProfile();
      capturedOnSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['profile-me'] });
    });
  });

  describe('useAvatarUrl', () => {
    it('calls useQuery with the correct query key', () => {
      useAvatarUrl();
      expect(mockUseQuery).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['profile-avatar-url'] }),
      );
    });

    it('has a select function that extracts url', () => {
      useAvatarUrl();
      const config = mockUseQuery.mock.calls[0][0];
      expect(config.select({ url: 'https://example.com/avatar.png' })).toBe(
        'https://example.com/avatar.png',
      );
    });
  });

  describe('useUploadAvatar', () => {
    it('calls useMutation', () => {
      useUploadAvatar();
      expect(mockUseMutation).toHaveBeenCalledTimes(1);
    });

    it('mutationFn delegates to uploadMyAvatar', () => {
      let capturedFn: (file: unknown) => unknown = () => {};
      mockUseMutation.mockImplementation((config: any) => {
        capturedFn = config.mutationFn;
        return { mutate: vi.fn() };
      });

      useUploadAvatar();
      const file = new File([''], 'avatar.png');
      capturedFn(file);
      expect(mockUploadMyAvatar).toHaveBeenCalledWith(file);
    });

    it('invalidates both profile and avatar queries on success', () => {
      let capturedOnSuccess: () => void = () => {};
      mockUseMutation.mockImplementation((config: any) => {
        capturedOnSuccess = config.onSuccess;
        return { mutate: vi.fn() };
      });

      useUploadAvatar();
      capturedOnSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['profile-me'] });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['profile-avatar-url'] });
    });
  });

  describe('useChangePassword', () => {
    it('calls useMutation', () => {
      useChangePassword();
      expect(mockUseMutation).toHaveBeenCalledTimes(1);
    });

    it('mutationFn delegates to changePassword', () => {
      let capturedFn: (dto: unknown) => unknown = () => {};
      mockUseMutation.mockImplementation((config: any) => {
        capturedFn = config.mutationFn;
        return { mutate: vi.fn() };
      });

      useChangePassword();
      const dto = { currentPassword: 'old', newPassword: 'new' };
      capturedFn(dto);
      expect(mockChangePassword).toHaveBeenCalledWith(dto);
    });
  });
});
