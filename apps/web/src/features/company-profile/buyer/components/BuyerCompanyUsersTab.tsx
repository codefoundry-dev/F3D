import type { UserResponse } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { UserRole, UserStatus } from '@forethread/shared-types/client';
import {
  StatusActionModal,
  StatusSuccessModal,
  ResetPasswordSuccessModal,
  useDebounce,
  notificationService,
  type DotAction,
} from '@forethread/ui-components';
import CrossInCircleIcon from '@forethread/ui-components/assets/icons/cross-in-circle.svg?react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';
import { useUserSort } from '@/features/users/company-admin/hooks/useUserSort';
import {
  useUsers,
  useDeactivateUser,
  useReactivateUser,
  useResendInvitation,
  useCancelInvitation,
  useResetUserPassword,
} from '@/features/users/company-admin/services/users.service';
import { useUsersStore } from '@/features/users/company-admin/state/users.store';
import { EditUserModal } from '@/features/users/company-admin/ui/EditUserModal';
import { ProjectAccessModal } from '@/features/users/company-admin/ui/ProjectAccessModal';
import { CompanyUsersTableView } from '@/features/users/shared/CompanyUsersTableView';

const PAGE_SIZE_OPTIONS = [10, 25, 50];

/** Roles a contractor company can assign (excludes Super Admin + Vendor). */
const CONTRACTOR_ROLES: UserRole[] = [
  UserRole.COMPANY_ADMIN,
  UserRole.PROCUREMENT_OFFICER,
  UserRole.FINANCIAL_OFFICER,
  UserRole.WAREHOUSE_OFFICER,
  UserRole.FOREMAN,
];

/**
 * Buyer "Company users" tab (US 1.09) — the company-admin user list scoped to
 * the logged-in admin's own company, rendered with the shared table view. The
 * Invite-user action lives in the page header.
 */
export function BuyerCompanyUsersTab() {
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
  const [projectAccessUser, setProjectAccessUser] = useState<{
    id: string;
    name: string;
    projectIds: string[];
  } | null>(null);

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
  const resetPasswordMutation = useResetUserPassword();

  const { data, isLoading, isError } = useUsers({
    page,
    limit: pageSize,
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
  const roleOptions = CONTRACTOR_ROLES.map((role) => ({
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
      onSuccess: () => {
        closeCancelInvitationModal();
        notificationService.success(t('cancelInvitationSuccess'));
      },
    });
  };

  const getRowActions = (user: UserResponse): DotAction[] => {
    if (user.status === UserStatus.INVITED) {
      return [
        {
          key: 'resendInvitation',
          label: t('actions.resendInvitation'),
          onClick: () =>
            resendMutation.mutate(user.id, {
              onSuccess: () => notificationService.success(t('resendInvitationSuccess')),
            }),
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
        key: 'projectAccess',
        label: t('actions.projectAccess'),
        onClick: () =>
          setProjectAccessUser({
            id: user.id,
            name: user.name,
            projectIds: user.projects?.map((p) => p.id) ?? [],
          }),
      },
    ];

    if (user.status !== UserStatus.INACTIVE) {
      actions.push({
        key: 'resetPassword',
        label: t('actions.resetPassword'),
        onClick: () => {
          resetPasswordMutation.mutate(user.id, {
            onSuccess: () => openResetPasswordSuccessModal(user.email),
          });
        },
      });
    }

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
        onView={(id) => navigate(ROUTES.userDetail.replace(':id', id))}
        onEdit={(id) => openEditModal(id)}
      />

      {/* Row-triggered modals (Invite/Create is rendered by the page header) */}
      {isEditModalOpen && <EditUserModal onClose={closeEditModal} />}

      {projectAccessUser && (
        <ProjectAccessModal
          userId={projectAccessUser.id}
          userName={projectAccessUser.name}
          currentProjectIds={projectAccessUser.projectIds}
          onClose={() => setProjectAccessUser(null)}
        />
      )}

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
              <CrossInCircleIcon className="h-6 w-6 text-foreground" />
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
          icon={<CrossInCircleIcon className="h-6 w-6 text-foreground" />}
        />
      )}
    </>
  );
}
