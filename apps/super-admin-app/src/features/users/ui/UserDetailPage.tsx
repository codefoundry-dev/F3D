import { type UserResponse } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { UserStatus } from '@forethread/shared-types/client';
import {
  Spinner,
  DotActionsMenu,
  StatusActionModal,
  StatusSuccessModal,
  AvatarUpload,
  notificationService,
  type DotAction,
} from '@forethread/ui-components';
import CrossInCircleIcon from '@forethread/ui-components/assets/icons/cross-in-circle.svg?react';
import EnvelopeIcon from '@forethread/ui-components/assets/icons/envelope-simple.svg?react';
import { useParams, useNavigate } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

import { ProfileInfoGrid } from '../../profile/ui/ProfileInfoGrid';
import {
  RolePermissionsSection,
  ApprovalResponsibilitiesSection,
  ActivityLogSection,
} from '../../profile/ui/ProfileSections';
import {
  useUser,
  useDeactivateUser,
  useReactivateUser,
  useResendInvitation,
  useCancelInvitation,
} from '../services/users.service';
import { useUsersStore } from '../state/users.store';

import { EditUserModal } from './EditUserModal';

export default function UserDetailPage() {
  const { t } = useTranslation(['users', 'common', 'profile']);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    isEditModalOpen,
    openEditModal,
    closeEditModal,
    isStatusActionModalOpen,
    statusActionType,
    statusActionUserId,
    statusActionUserEmail,
    openStatusActionModal,
    closeStatusActionModal,
    isStatusSuccessModalOpen,
    statusSuccessType,
    statusSuccessUserEmail,
    openStatusSuccessModal,
    closeStatusSuccessModal,
    isCancelInvitationModalOpen,
    cancelInvitationUserId,
    cancelInvitationUserEmail,
    cancelInvitationUserName,
    openCancelInvitationModal,
    closeCancelInvitationModal,
  } = useUsersStore();

  const { data: user, isLoading, isError } = useUser(id ?? '');
  const deactivateMutation = useDeactivateUser();
  const reactivateMutation = useReactivateUser();
  const resendMutation = useResendInvitation();
  const cancelInvitationMutation = useCancelInvitation();

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
      {/* Single card wrapping all content */}
      <div className="bg-card rounded-xl border border-border p-8 space-y-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-5">
            <AvatarUpload name={user.name} avatarUrl={user.avatarUrl} editable={false} />
            <div>
              <h2 className="text-2xl font-bold text-foreground">{user.name}</h2>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                <EnvelopeIcon className="w-4 h-4" />
                {user.email}
              </div>
            </div>
          </div>
          <DotActionsMenu
            actions={getUserActions(
              user,
              {
                onEdit: () => openEditModal(user.id),
                onResend: () =>
                  resendMutation.mutate(user.id, {
                    onSuccess: () => notificationService.success(t('resendInvitationSuccess')),
                  }),
                onCancelInvitation: () => openCancelInvitationModal(user.id, user.email, user.name),
                onActivate: () => openStatusActionModal('activate', user.id, user.email),
                onDeactivate: () => openStatusActionModal('deactivate', user.id, user.email),
              },
              {
                editUser: t('detail.editUser'),
                resendInvitation: t('detail.resendInvitation'),
                cancelInvitation: t('detail.cancelInvitation'),
                activate: t('detail.activate'),
                deactivate: t('detail.deactivate'),
              },
            )}
          />
        </div>

        <ProfileInfoGrid
          phone={user.phone}
          status={user.status}
          role={user.role}
          createdAt={user.createdAt}
          position={user.position}
          company={user.company?.legalName}
        />

        <RolePermissionsSection />
        <ApprovalResponsibilitiesSection />
        <ActivityLogSection userId={user.id} />
      </div>

      {/* Modals */}
      {isEditModalOpen && <EditUserModal onClose={closeEditModal} />}

      {isStatusActionModalOpen && statusActionType && (
        <StatusActionModal
          onClose={closeStatusActionModal}
          onConfirm={() => {
            if (!statusActionUserId || !statusActionType || !statusActionUserEmail) return;
            const mutation =
              statusActionType === 'deactivate' ? deactivateMutation : reactivateMutation;
            mutation.mutate(statusActionUserId, {
              onSuccess: () => {
                closeStatusActionModal();
                openStatusSuccessModal(statusActionType, statusActionUserEmail);
              },
            });
          }}
          isLoading={
            statusActionType === 'deactivate'
              ? deactivateMutation.isPending
              : reactivateMutation.isPending
          }
          title={t(`${statusActionType}Modal.title` as 'activateModal.title')}
          subtitle={t(`${statusActionType}Modal.subtitle` as 'activateModal.subtitle')}
          infoText={
            <span
              dangerouslySetInnerHTML={{
                __html: t(`${statusActionType}Modal.info` as 'activateModal.info', {
                  email: statusActionUserEmail ?? '',
                  interpolation: { escapeValue: false },
                }),
              }}
            />
          }
          confirmLabel={t(`${statusActionType}Modal.confirm` as 'activateModal.confirm')}
          cancelLabel={t('common:cancel')}
          variant={statusActionType === 'deactivate' ? 'danger' : 'default'}
          icon={
            statusActionType === 'deactivate' ? (
              <CrossInCircleIcon className="w-6 h-6 text-foreground" />
            ) : undefined
          }
        />
      )}

      {isStatusSuccessModalOpen && statusSuccessType && (
        <StatusSuccessModal
          onClose={closeStatusSuccessModal}
          title={t(
            `${statusSuccessType === 'deactivate' ? 'deactivationSuccess' : 'activationSuccess'}.title` as 'deactivationSuccess.title',
          )}
          description={
            <span
              dangerouslySetInnerHTML={{
                __html: t(
                  `${statusSuccessType === 'deactivate' ? 'deactivationSuccess' : 'activationSuccess'}.description` as 'deactivationSuccess.description',
                  {
                    email: statusSuccessUserEmail ?? '',
                    interpolation: { escapeValue: false },
                  },
                ),
              }}
            />
          }
          note={t(
            `${statusSuccessType === 'deactivate' ? 'deactivationSuccess' : 'activationSuccess'}.note` as 'deactivationSuccess.note',
          )}
          buttonLabel={t(
            `${statusSuccessType === 'deactivate' ? 'deactivationSuccess' : 'activationSuccess'}.backButton` as 'deactivationSuccess.backButton',
          )}
          redirectLabel={(seconds) =>
            t(
              `${statusSuccessType === 'deactivate' ? 'deactivationSuccess' : 'activationSuccess'}.redirecting` as 'deactivationSuccess.redirecting',
              { seconds },
            )
          }
        />
      )}

      {isCancelInvitationModalOpen && (
        <StatusActionModal
          onClose={closeCancelInvitationModal}
          onConfirm={() => {
            if (!cancelInvitationUserId) return;
            cancelInvitationMutation.mutate(cancelInvitationUserId, {
              onSuccess: () => {
                closeCancelInvitationModal();
                notificationService.success(t('cancelInvitationSuccess'));
                navigate(ROUTES.users);
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
                  name: cancelInvitationUserName ?? '',
                  email: cancelInvitationUserEmail ?? '',
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

/** Build dot-menu actions based on user status */
function getUserActions(
  user: UserResponse,
  handlers: {
    onEdit: () => void;
    onResend: () => void;
    onCancelInvitation: () => void;
    onActivate: () => void;
    onDeactivate: () => void;
  },
  labels: {
    editUser: string;
    resendInvitation: string;
    cancelInvitation: string;
    activate: string;
    deactivate: string;
  },
): DotAction[] {
  const actions: DotAction[] = [{ key: 'edit', label: labels.editUser, onClick: handlers.onEdit }];

  if (user.status === UserStatus.INVITED) {
    actions.push(
      { key: 'resendInvitation', label: labels.resendInvitation, onClick: handlers.onResend },
      {
        key: 'cancelInvitation',
        label: labels.cancelInvitation,
        onClick: handlers.onCancelInvitation,
      },
    );
  } else if (user.status === UserStatus.INACTIVE) {
    actions.push({ key: 'activate', label: labels.activate, onClick: handlers.onActivate });
  } else if (user.status === UserStatus.ACTIVE) {
    actions.push({ key: 'deactivate', label: labels.deactivate, onClick: handlers.onDeactivate });
  }

  return actions;
}
