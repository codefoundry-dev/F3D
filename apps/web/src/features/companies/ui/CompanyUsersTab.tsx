import type { UserResponse } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { UserStatus } from '@forethread/shared-types/client';
import {
  StatusActionModal,
  StatusSuccessModal,
  ResetPasswordSuccessModal,
  useDebounce,
  type DotAction,
} from '@forethread/ui-components';
import CrossInCircleIcon from '@forethread/ui-components/assets/icons/cross-in-circle.svg?react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';
import { CompanyUsersTableView } from '@/features/users/shared/CompanyUsersTableView';
import { ALL_ROLE_OPTIONS } from '@/features/users/super-admin/constants/roles';
import { useUserSort } from '@/features/users/super-admin/hooks/useUserSort';
import {
  useUsers,
  useDeactivateUser,
  useReactivateUser,
  useResendInvitation,
  useCancelInvitation,
  useInitiateResetPassword,
} from '@/features/users/super-admin/services/users.service';
import { useUsersStore } from '@/features/users/super-admin/state/users.store';

import { EditUserModal } from '../../users/super-admin/ui/EditUserModal';

const PAGE_SIZE_OPTIONS = [10, 25, 50];

interface CompanyUsersTabProps {
  companyId: string;
}

export function CompanyUsersTab({ companyId }: CompanyUsersTabProps) {
  const { t } = useTranslation(['users', 'common']);
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const { sortField, sortDir, handleSort } = useUserSort();

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

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
    isResetPasswordSuccessModalOpen,
    resetPasswordSuccessEmail,
    openResetPasswordSuccessModal,
    closeResetPasswordSuccessModal,
    isCancelInvitationModalOpen,
    cancelInvitationUserId,
    cancelInvitationUserEmail,
    cancelInvitationUserName,
    openCancelInvitationModal,
    closeCancelInvitationModal,
  } = useUsersStore();

  const deactivateMutation = useDeactivateUser();
  const reactivateMutation = useReactivateUser();
  const resendMutation = useResendInvitation();
  const cancelInvitationMutation = useCancelInvitation();
  const resetPasswordMutation = useInitiateResetPassword();

  const { data, isLoading, isError } = useUsers({
    page,
    limit: pageSize,
    companyId,
    search: debouncedSearch || undefined,
    status: selectedStatuses.length ? selectedStatuses.join(',') : undefined,
    role: selectedRoles.length ? selectedRoles.join(',') : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    sortBy: sortField ?? undefined,
    sortDir: sortDir ?? undefined,
  });

  const total = data?.meta.total ?? 0;
  const hasActiveFilters = Boolean(
    debouncedSearch || selectedStatuses.length || selectedRoles.length || dateFrom || dateTo,
  );

  const statusOptions = [
    { value: UserStatus.ACTIVE, label: t('statuses.ACTIVE') },
    { value: UserStatus.INACTIVE, label: t('statuses.INACTIVE') },
    { value: UserStatus.INVITED, label: t('statuses.INVITED') },
  ];
  const roleOptions = ALL_ROLE_OPTIONS.map((role) => ({
    value: role,
    label: String(t(`roles.${role}` as 'roles.COMPANY_ADMIN')),
  }));

  const handleStatusAction = () => {
    if (!statusActionUserId || !statusActionType || !statusActionUserEmail) return;
    const mutation = statusActionType === 'deactivate' ? deactivateMutation : reactivateMutation;
    mutation.mutate(statusActionUserId, {
      onSuccess: () => {
        closeStatusActionModal();
        openStatusSuccessModal(statusActionType, statusActionUserEmail);
      },
    });
  };

  const handleCancelInvitation = () => {
    if (!cancelInvitationUserId) return;
    cancelInvitationMutation.mutate(cancelInvitationUserId, {
      onSuccess: () => closeCancelInvitationModal(),
    });
  };

  const getRowActions = (user: UserResponse): DotAction[] => {
    if (user.status === UserStatus.INVITED) {
      return [
        {
          key: 'resendInvitation',
          label: t('actions.resendInvitation'),
          onClick: () => resendMutation.mutate(user.id),
        },
        {
          key: 'cancelInvitation',
          label: t('actions.cancelInvitation'),
          onClick: () => openCancelInvitationModal(user.id, user.email, user.name),
        },
      ];
    }

    const actions: DotAction[] = [
      {
        key: 'resetPassword',
        label: t('actions.resetPassword'),
        onClick: () => {
          resetPasswordMutation.mutate(user.id, {
            onSuccess: () => openResetPasswordSuccessModal(user.email),
          });
        },
      },
    ];

    if (user.status === UserStatus.INACTIVE) {
      actions.push({
        key: 'activate',
        label: t('actions.activate'),
        onClick: () => openStatusActionModal('activate', user.id, user.email),
      });
    } else {
      actions.push({
        key: 'deactivate',
        label: t('actions.deactivate'),
        onClick: () => openStatusActionModal('deactivate', user.id, user.email),
      });
    }

    return actions;
  };

  return (
    <>
      <CompanyUsersTableView
        users={data?.items ?? []}
        total={total}
        isLoading={isLoading}
        isError={isError}
        hasActiveFilters={hasActiveFilters}
        search={search}
        onSearchChange={setSearch}
        statusOptions={statusOptions}
        selectedStatuses={selectedStatuses}
        onStatusChange={(v) => {
          setSelectedStatuses(v);
          setPage(1);
        }}
        roleOptions={roleOptions}
        selectedRoles={selectedRoles}
        onRoleChange={(v) => {
          setSelectedRoles(v);
          setPage(1);
        }}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={(d) => {
          setDateFrom(d);
          setPage(1);
        }}
        onDateToChange={(d) => {
          setDateTo(d);
          setPage(1);
        }}
        onClearDates={() => {
          setDateFrom('');
          setDateTo('');
          setPage(1);
        }}
        sortField={sortField}
        sortDir={sortDir}
        onSort={(field) => {
          handleSort(field as Parameters<typeof handleSort>[0]);
          setPage(1);
        }}
        page={data?.meta.page ?? page}
        pageSize={pageSize}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        getRowActions={getRowActions}
        onView={(id) => void navigate(ROUTES.userDetail.replace(':id', id))}
        onEdit={(id) => openEditModal(id)}
      />

      {/* Modals (Invite/Create is rendered by the page header) */}
      {isEditModalOpen && <EditUserModal onClose={closeEditModal} />}

      {isStatusActionModalOpen && statusActionType && (
        <StatusActionModal
          onClose={closeStatusActionModal}
          onConfirm={handleStatusAction}
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

      {isResetPasswordSuccessModalOpen && (
        <ResetPasswordSuccessModal
          onClose={closeResetPasswordSuccessModal}
          title={t('resetPasswordSuccess.title')}
          subtitle={t('resetPasswordSuccess.subtitle')}
          infoText={
            <span
              dangerouslySetInnerHTML={{
                __html: t('resetPasswordSuccess.info', {
                  email: resetPasswordSuccessEmail ?? '',
                  interpolation: { escapeValue: false },
                }),
              }}
            />
          }
          buttonLabel={t('resetPasswordSuccess.backButton')}
          redirectLabel={(seconds) => t('resetPasswordSuccess.redirecting', { seconds })}
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
                  { email: statusSuccessUserEmail ?? '', interpolation: { escapeValue: false } },
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
          onConfirm={handleCancelInvitation}
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
    </>
  );
}
