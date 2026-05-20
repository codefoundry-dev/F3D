import { type UserResponse } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { UserStatus } from '@forethread/shared-types/client';
import {
  Spinner,
  DotActionsMenu,
  StatusActionModal,
  AvatarUpload,
  notificationService,
  type DotAction,
} from '@forethread/ui-components';
import CrossInCircleIcon from '@forethread/ui-components/assets/icons/cross-in-circle.svg?react';
import EnvelopeIcon from '@forethread/ui-components/assets/icons/envelope-simple.svg?react';
import { useParams, useNavigate } from 'react-router-dom';

import { ProfileInfoGrid } from '../../../profile/ui/ProfileInfoGrid';
import {
  RolePermissionsSection,
  ApprovalResponsibilitiesSection,
  ActivityLogSection,
} from '../../../profile/ui/ProfileSections';
import {
  useVendorUser,
  useResendVendorUserInvitation,
  useCancelVendorUserInvitation,
} from '../services/vendor-users.service';
import { useVendorUsersStore } from '../state/vendor-users.store';

const USERS_PATH = '/users';

export default function VendorUserDetailPage() {
  const { t } = useTranslation(['vendorUsers', 'common', 'profile']);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    isStatusActionModalOpen,
    statusActionType,
    statusActionUserId,
    statusActionUserEmail,
    openStatusActionModal,
    closeStatusActionModal,
  } = useVendorUsersStore();

  const { data: user, isLoading, isError } = useVendorUser(id ?? '');
  const resendMutation = useResendVendorUserInvitation();
  const cancelInvitationMutation = useCancelVendorUserInvitation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="md" />
      </div>
    );
  }

  if (isError || !user) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-foreground">{t('detail.notFound')}</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="bg-card rounded-xl border border-border p-8 space-y-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-5">
            <AvatarUpload name={user.name} avatarUrl={user.avatarUrl} editable={false} />
            <div>
              <h2 className="text-2xl font-bold text-foreground">{user.name}</h2>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1 min-w-0">
                <EnvelopeIcon className="w-4 h-4 shrink-0" />
                <span className="truncate" title={user.email}>
                  {user.email}
                </span>
              </div>
            </div>
          </div>
          {user.status === UserStatus.INVITED && (
            <DotActionsMenu
              actions={getUserActions(
                user,
                {
                  onResend: () =>
                    resendMutation.mutate(user.id, {
                      onSuccess: () => notificationService.success(t('resendInvitationSuccess')),
                    }),
                  onCancelInvitation: () =>
                    openStatusActionModal('cancelInvitation', user.id, user.email),
                },
                {
                  resendInvitation: t('detail.resendInvitation'),
                  cancelInvitation: t('detail.cancelInvitation'),
                },
              )}
            />
          )}
        </div>

        <ProfileInfoGrid
          phone={user.phone}
          status={user.status}
          role={user.role}
          createdAt={user.createdAt}
          position={user.position}
        />

        <RolePermissionsSection />
        <ApprovalResponsibilitiesSection />
        <ActivityLogSection userId={user.id} />
      </div>

      {isStatusActionModalOpen && statusActionType === 'cancelInvitation' && (
        <StatusActionModal
          onClose={closeStatusActionModal}
          onConfirm={() => {
            if (!statusActionUserId) return;
            cancelInvitationMutation.mutate(statusActionUserId, {
              onSuccess: () => {
                closeStatusActionModal();
                notificationService.success(t('cancelInvitationSuccess'));
                navigate(USERS_PATH);
              },
            });
          }}
          isLoading={cancelInvitationMutation.isPending}
          title={t('cancelInvitationModal.title')}
          subtitle={t('cancelInvitationModal.subtitle')}
          infoText={
            <span
              dangerouslySetInnerHTML={{
                __html: t('cancelInvitationModal.info', {
                  email: statusActionUserEmail ?? '',
                  interpolation: { escapeValue: false },
                }),
              }}
            />
          }
          confirmLabel={t('cancelInvitationModal.confirm')}
          cancelLabel={t('common:cancel')}
          variant="danger"
          icon={<CrossInCircleIcon className="w-6 h-6 text-foreground" />}
        />
      )}
    </div>
  );
}

function getUserActions(
  user: UserResponse,
  handlers: {
    onResend: () => void;
    onCancelInvitation: () => void;
  },
  labels: {
    resendInvitation: string;
    cancelInvitation: string;
  },
): DotAction[] {
  // Vendors can only manage invitations, not edit/deactivate users
  if (user.status === UserStatus.INVITED) {
    return [
      { key: 'resendInvitation', label: labels.resendInvitation, onClick: handlers.onResend },
      {
        key: 'cancelInvitation',
        label: labels.cancelInvitation,
        onClick: handlers.onCancelInvitation,
      },
    ];
  }

  return [];
}
