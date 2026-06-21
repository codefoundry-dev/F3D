import type { UserResponse } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { CompanyType, UserStatus } from '@forethread/shared-types/client';
import {
  Button,
  Spinner,
  TablePagination,
  EmptyState,
  EmptyBoxIllustration,
  DotActionsMenu,
  SortIcon,
  StatusActionModal,
  StatusSuccessModal,
  ResetPasswordSuccessModal,
  type DotAction,
} from '@forethread/ui-components';
import CrossInCircleIcon from '@forethread/ui-components/assets/icons/cross-in-circle.svg?react';
import EditIcon from '@forethread/ui-components/assets/icons/edit.svg?react';
import EyeIcon from '@forethread/ui-components/assets/icons/eye-opened.svg?react';
import NewUserIcon from '@forethread/ui-components/assets/icons/new-user.svg?react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';
import { RoleBadge, StatusBadge } from '@/features/users/shared/userBadges';
import {
  useUsers,
  useDeactivateUser,
  useReactivateUser,
  useResendInvitation,
  useCancelInvitation,
  useInitiateResetPassword,
} from '@/features/users/super-admin/services/users.service';
import { useUsersStore } from '@/features/users/super-admin/state/users.store';

import { CreateUserModal } from '../../users/super-admin/ui/CreateUserModal';
import { EditUserModal } from '../../users/super-admin/ui/EditUserModal';

type SortField = 'name' | 'email' | 'phone' | 'role' | 'status';
type SortDir = 'asc' | 'desc';

/** 28px gradient-white bordered icon button (row-level actions) — matches the anchor. */
const ICON_BTN_28 =
  'flex size-7 shrink-0 items-center justify-center rounded-[8px] border border-gray-100 bg-gradient-to-b from-[#F9F9FA] to-white text-gray-600 shadow-[0_1px_6px_0_rgba(10,13,18,0.06),0_1px_2px_0_rgba(10,13,18,0.02)] transition-colors hover:bg-none hover:bg-gray-50 hover:text-gray-900';

interface CompanyUsersTabProps {
  companyId: string;
  companyName: string;
  companyType: CompanyType;
}

export function CompanyUsersTab({ companyId, companyName, companyType }: CompanyUsersTabProps) {
  const { t } = useTranslation(['users', 'common', 'company']);
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir | null>(null);

  const {
    isCreateModalOpen,
    openCreateModal,
    closeCreateModal,
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
    sortBy: sortField ?? undefined,
    sortDir: sortDir ?? undefined,
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDir === 'asc') {
        setSortDir('desc');
      } else {
        setSortField(null);
        setSortDir(null);
      }
    } else {
      setSortField(field);
      setSortDir('asc');
    }
    setPage(1);
  };

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

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-AU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const sortableColumns: { field: SortField; label: string; className?: string }[] = [
    { field: 'name', label: t('columns.fullName'), className: 'px-6' },
    { field: 'email', label: t('columns.email') },
    { field: 'phone', label: t('columns.phone') },
    { field: 'role', label: t('columns.role') },
    { field: 'status', label: t('columns.status') },
  ];

  return (
    <>
      {/* Heading + Invite user button */}
      <div className="flex items-center justify-between pb-4">
        <h3 className="text-base font-semibold text-gray-900">{t('company:companyUsersTitle')}</h3>
        <Button onClick={openCreateModal} leftIcon={<NewUserIcon className="size-4" />}>
          {t('inviteUser')}
        </Button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <Spinner size="md" />
        </div>
      ) : isError ? (
        <div className="flex h-48 items-center justify-center text-sm text-destructive">
          {t('failedToLoad')}
        </div>
      ) : !data?.items.length ? (
        <div className="flex items-center justify-center rounded-[10px] border border-gray-100 bg-white py-6 shadow-[0_1px_6px_0_rgba(10,13,18,0.06),0_1px_2px_0_rgba(10,13,18,0.02)]">
          <EmptyState
            illustration={<EmptyBoxIllustration />}
            title={t('noUsersFound')}
            description={t('createFirstUser')}
          />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[12px] border border-gray-100">
          <table className="w-full min-w-[800px] table-fixed border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-[#F9F9FA]">
                {sortableColumns.map((col) => (
                  <th key={col.field} className="h-9 px-3 text-left align-middle">
                    <button
                      type="button"
                      onClick={() => handleSort(col.field)}
                      className="inline-flex items-center gap-1 font-semibold text-gray-500 transition-colors hover:text-gray-700"
                    >
                      {col.label}
                      <SortIcon
                        active={sortField === col.field}
                        direction={sortField === col.field ? sortDir : null}
                      />
                    </button>
                  </th>
                ))}
                <th className="h-9 px-3 text-left align-middle">
                  <span className="inline-flex items-center gap-1 font-semibold text-gray-500">
                    {t('columns.dateJoined')}
                    <SortIcon />
                  </span>
                </th>
                <th className="h-9 w-[120px] px-3 text-left align-middle">
                  <span className="font-semibold text-gray-500">{t('columns.actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-gray-50 transition-colors last:border-0 hover:bg-gray-25"
                >
                  <td className="px-3 py-2.5 align-middle font-medium text-gray-800">{user.name}</td>
                  <td className="px-3 py-2.5 align-middle font-medium text-gray-800">
                    {user.email}
                  </td>
                  <td className="px-3 py-2.5 align-middle font-medium text-gray-800">
                    {user.phone ?? '—'}
                  </td>
                  <td className="px-3 py-2.5 align-middle">
                    <RoleBadge
                      role={user.role}
                      label={t(`roles.${user.role}` as 'roles.COMPANY_ADMIN')}
                    />
                  </td>
                  <td className="px-3 py-2.5 align-middle">
                    <StatusBadge
                      status={user.status}
                      label={t(`statuses.${user.status}` as 'statuses.ACTIVE')}
                    />
                  </td>
                  <td className="px-3 py-2.5 align-middle font-medium text-gray-800">
                    {formatDate(user.createdAt)}
                  </td>
                  <td className="px-3 py-2.5 align-middle">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className={ICON_BTN_28}
                        aria-label="View"
                        onClick={() => navigate(ROUTES.userDetail.replace(':id', user.id))}
                      >
                        <EyeIcon className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        className={ICON_BTN_28}
                        aria-label="Edit"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(user.id);
                        }}
                      >
                        <EditIcon className="size-3.5" />
                      </button>
                      <DotActionsMenu
                        actions={getRowActions(user)}
                        bordered={false}
                        triggerClassName={ICON_BTN_28}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.meta.total > 10 && (
        <TablePagination
          page={data.meta.page}
          totalItems={data.meta.total}
          pageSize={pageSize}
          pageSizeOptions={[10, 25, 50]}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          rowsPerPageLabel={t('common:rowsPerPage')}
          showingLabel={({ from, to, total }) => t('common:showingItems', { from, to, total })}
          backLabel={t('common:back')}
          nextLabel={t('common:next')}
        />
      )}

      {/* Modals */}
      {isCreateModalOpen && (
        <CreateUserModal
          onClose={closeCreateModal}
          preselectedCompany={{ id: companyId, name: companyName, type: companyType }}
        />
      )}
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
