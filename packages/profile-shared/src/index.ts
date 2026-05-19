// Components
export { default as UserProfilePage } from './components/UserProfilePage';
export type { UserProfilePageProps } from './components/UserProfilePage';

export { EditProfileModal } from './components/EditProfileModal';
export type { EditProfileModalProps } from './components/EditProfileModal';

export { ProfileInfoGrid } from './components/ProfileInfoGrid';
export type { ProfileInfoGridProps } from './components/ProfileInfoGrid';

export {
  RolePermissionsSection,
  ApprovalResponsibilitiesSection,
  ActivityLogSection,
} from './components/ProfileSections';
export type { RolePermissionsSectionProps } from './components/ProfileSections';

// Services / hooks
export {
  useProfile,
  useUpdateProfile,
  useAvatarUrl,
  useUploadAvatar,
  useChangePassword,
} from './services/profile.service';

// Constants
export { DEFAULT_PERMISSION_KEYS, AUDIT_ACTION_LABELS } from './constants';
