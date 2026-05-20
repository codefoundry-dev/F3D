import type { UserResponse } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { CompanyType, UserStatus } from '@forethread/shared-types/client';
import {
  cn,
  Button,
  Spinner,
  Badge,
  TablePagination,
  EmptyState,
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
import { ROLE_BADGE_COLORS, STATUS_TEXT_COLORS } from '@/features/users/super-admin/constants/roles';
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

interface CompanyUsersTabProps {
  companyId: string;
  companyName: string;
  companyType: CompanyType;
}

export function CompanyUsersTab({ companyId, companyName, companyType }: CompanyUsersTabProps) {
  const { t } = useTranslation(['users', 'common']);
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
      {/* Invite user button */}
      <div className="flex justify-end pb-4">
        <Button onClick={openCreateModal} className="gap-2">
          <NewUserIcon className="w-4 h-4" />
          {t('inviteUser')}
        </Button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Spinner size="md" />
        </div>
      ) : isError ? (
        <div className="flex items-center justify-center h-48 text-destructive text-sm">
          {t('failedToLoad')}
        </div>
      ) : !data?.items.length ? (
        <div className="py-12">
          <EmptyState title={t('noUsersFound')} description={t('createFirstUser')} />
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm table-fixed">
            <thead>
              <tr className="border-b border-border bg-[hsl(var(--table-header))] font-['Inter'] text-[hsl(var(--table-header-foreground))]">
                {sortableColumns.map((col) => (
                  <th
                    key={col.field}
                    className={cn(
                      'px-4 py-3 text-left text-xs font-bold leading-4 tracking-[0.6px] cursor-pointer select-none transition-colors',
                      col.className,
                    )}
                    onClick={() => handleSort(col.field)}
                  >
                    <span className="flex items-center justify-between w-full">
                      {col.label}
                      <SortIcon
                        active={sortField === col.field}
                        direction={sortField === col.field ? sortDir : null}
                      />
                    </span>
                  </th>
                ))}
                <th className="px-4 py-3 text-left text-xs font-bold leading-4 tracking-[0.6px]">
                  <span className="flex items-center justify-between w-full">
                    {t('columns.dateJoined')}
                    <SortIcon />
                  </span>
                </th>
                <th className="w-[100px] px-4 py-3 text-right text-xs font-bold leading-4 tracking-[0.6px]">
                  {t('columns.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.items.map((user) => (
                <tr key={user.id} className="hover:bg-accent/50 transition-colors">
                  <td className="px-6 py-4 text-foreground">{user.name}</td>
                  <td className="px-4 py-4 text-muted-foreground">{user.email}</td>
                  <td className="px-4 py-4 text-muted-foreground">{user.phone ?? '—'}</td>
                  <td className="px-4 py-4">
                    <Badge
                      className={cn(
                        'rounded',
                        ROLE_BADGE_COLORS[user.role] ?? 'bg-muted text-muted-foreground',
                      )}
                    >
                      {t(`roles.${user.role}` as 'roles.COMPANY_ADMIN')}
                    </Badge>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={cn(
                        'text-sm',
                        STATUS_TEXT_COLORS[user.status] ?? 'text-muted-foreground',
                      )}
                    >
                      {t(`statuses.${user.status}` as 'statuses.ACTIVE')}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-muted-foreground">{formatDate(user.createdAt)}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="View"
                        onClick={() => navigate(ROUTES.userDetail.replace(':id', user.id))}
                      >
                        <EyeIcon className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Edit"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(user.id);
                        }}
                      >
                        <EditIcon className="w-4 h-4" />
                      </button>
                      <DotActionsMenu actions={getRowActions(user)} bordered={false} />
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
