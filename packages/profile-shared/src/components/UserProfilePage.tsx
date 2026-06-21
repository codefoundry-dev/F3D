import { useTranslation } from '@forethread/i18n';
import { usePageTitleStore } from '@forethread/rfq-shared';
import { Spinner, Button, AvatarUpload, ChangePasswordModal } from '@forethread/ui-components';
import CheckCircleIcon from '@forethread/ui-components/assets/icons/checkcircle-icon.svg?react';
import EditIcon from '@forethread/ui-components/assets/icons/edit-without-line.svg?react';
import EnvelopeIcon from '@forethread/ui-components/assets/icons/envelope-simple.svg?react';
import EyeClosedIcon from '@forethread/ui-components/assets/icons/eye-closed.svg?react';
import EyeOpenedIcon from '@forethread/ui-components/assets/icons/eye-opened.svg?react';
import LockSimpleIcon from '@forethread/ui-components/assets/icons/lock-simple.svg?react';
import { useEffect, useMemo, useState } from 'react';

import {
  useProfile,
  useAvatarUrl,
  useUploadAvatar,
  useChangePassword,
} from '../services/profile.service';
import { EditProfileModal } from './EditProfileModal';
import { ProfileInfoGrid } from './ProfileInfoGrid';
import {
  RolePermissionsSection,
  ApprovalResponsibilitiesSection,
  ActivityLogSection,
} from './ProfileSections';

export interface UserProfilePageProps {
  /** Override permission i18n keys for the RolePermissionsSection */
  permissionKeys?: readonly string[];
  /** Assigned projects to display in the info grid */
  projects?: { id: string; name: string }[];
  /** Callback for the "Project Access" button */
  onProjectAccess?: () => void;
}

export default function UserProfilePage({
  permissionKeys,
  projects,
  onProjectAccess,
}: UserProfilePageProps = {}) {
  const { t } = useTranslation(['profile', 'users', 'common', 'auth']);

  // App-bar breadcrumb / page title (top-level /me page → single leaf crumb).
  const setPageTitle = usePageTitleStore((s) => s.setTitle);
  useEffect(() => {
    setPageTitle(t('title'), null, null, [{ label: t('title') }]);
    return () => setPageTitle(null);
  }, [setPageTitle, t]);

  const { data: profile, isLoading } = useProfile();
  const { data: avatarUrl } = useAvatarUrl();
  const uploadAvatarMutation = useUploadAvatar();
  const changePasswordMutation = useChangePassword();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  const passwordLabels = useMemo(
    () => ({
      title: t('changePassword'),
      description: t('changePasswordDescription'),
      currentPassword: t('currentPassword'),
      currentPasswordPlaceholder: t('currentPasswordPlaceholder'),
      newPassword: t('newPassword'),
      newPasswordPlaceholder: t('newPasswordPlaceholder'),
      confirmNewPassword: t('confirmNewPassword'),
      confirmNewPasswordPlaceholder: t('confirmNewPasswordPlaceholder'),
      requirementsLabel: t('auth:passwordMustContain'),
      submitLabel: t('updatePassword'),
      submittingLabel: t('updatingPassword'),
      cancelLabel: t('common:cancel'),
      successMessage: t('passwordSuccess'),
      passwordMismatch: t('passwordMismatch'),
    }),
    [t],
  );

  const passwordRules = useMemo(
    () => [
      { key: 'minLength', label: t('auth:reqMinChars'), test: (v: string) => v.length >= 8 },
      { key: 'lowercase', label: t('auth:reqLowercase'), test: (v: string) => /[a-z]/.test(v) },
      { key: 'uppercase', label: t('auth:reqUppercase'), test: (v: string) => /[A-Z]/.test(v) },
      { key: 'number', label: t('auth:reqNumber'), test: (v: string) => /[0-9]/.test(v) },
      { key: 'special', label: t('auth:reqSymbol'), test: (v: string) => /[^A-Za-z0-9]/.test(v) },
    ],
    [t],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="md" />
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="p-6">
      {/* Profile Card */}
      <div className="bg-card rounded-xl border border-border p-8">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-5">
            <AvatarUpload
              name={profile.name}
              avatarUrl={avatarUrl}
              isUploading={uploadAvatarMutation.isPending}
              onUpload={(file) => uploadAvatarMutation.mutate(file)}
            />
            <div>
              <h2 className="text-2xl font-normal text-foreground">{profile.name}</h2>
              <div className="flex items-center gap-1.5 text-base text-muted-foreground mt-1">
                <EnvelopeIcon className="w-4 h-4" />
                {profile.email}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setIsChangePasswordOpen(true)}>
              <LockSimpleIcon className="w-4 h-4 mr-2" />
              {t('changePassword')}
            </Button>
            <Button variant="outline" onClick={() => setIsEditOpen(true)}>
              <EditIcon className="w-4 h-4 mr-2" />
              {t('editProfile')}
            </Button>
          </div>
        </div>

        <ProfileInfoGrid
          phone={profile.phone}
          status={profile.status}
          role={profile.role}
          createdAt={profile.createdAt}
          position={profile.position}
          projects={projects}
          onProjectAccess={onProjectAccess}
        />

        <RolePermissionsSection permissionKeys={permissionKeys} />
        <ApprovalResponsibilitiesSection />
        <ActivityLogSection userId={profile.id} />
      </div>

      {isEditOpen && <EditProfileModal onClose={() => setIsEditOpen(false)} />}

      {isChangePasswordOpen && (
        <ChangePasswordModal
          onClose={() => {
            setIsChangePasswordOpen(false);
            changePasswordMutation.reset();
          }}
          onSubmit={(data) => changePasswordMutation.mutate(data)}
          isPending={changePasswordMutation.isPending}
          isError={changePasswordMutation.isError}
          isSuccess={changePasswordMutation.isSuccess}
          errorMessage={
            (changePasswordMutation.error as Error | undefined)?.message ??
            'Failed to change password'
          }
          labels={passwordLabels}
          rules={passwordRules}
          icon={<LockSimpleIcon className="w-6 h-6 text-foreground" />}
          passwordIcon={<LockSimpleIcon className="w-5 h-5" />}
          eyeOpenIcon={<EyeOpenedIcon className="w-5 h-5" />}
          eyeClosedIcon={<EyeClosedIcon className="w-5 h-5" />}
          checkIcon={<CheckCircleIcon className="w-4 h-4" />}
        />
      )}
    </div>
  );
}
