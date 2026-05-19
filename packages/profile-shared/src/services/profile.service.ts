import {
  getMe,
  updateMe,
  changePassword,
  uploadMyAvatar,
  getMyAvatarUrl,
  type UpdateMeDto,
  type ChangePasswordDto,
} from '@forethread/api-client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const PROFILE_KEY = 'profile-me';
const AVATAR_URL_KEY = 'profile-avatar-url';

export function useProfile() {
  return useQuery({
    queryKey: [PROFILE_KEY],
    queryFn: getMe,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: UpdateMeDto) => updateMe(dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [PROFILE_KEY] });
    },
  });
}

export function useAvatarUrl() {
  return useQuery({
    queryKey: [AVATAR_URL_KEY],
    queryFn: getMyAvatarUrl,
    select: (d) => d.url,
  });
}

export function useUploadAvatar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => uploadMyAvatar(file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [PROFILE_KEY] });
      void queryClient.invalidateQueries({ queryKey: [AVATAR_URL_KEY] });
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (dto: ChangePasswordDto) => changePassword(dto),
  });
}
