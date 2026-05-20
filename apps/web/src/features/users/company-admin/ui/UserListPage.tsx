import type { UserResponse } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { UserStatus } from '@forethread/shared-types/client';
import {
  cn,
  Button,
  Spinner,
  Badge,
  TablePagination,
  EmptyState,
  DotActionsMenu,
  StatusActionModal,
  StatusSuccessModal,
  ResetPasswordSuccessModal,
  SortIcon,
  notificationService,
  type DotAction,
} from '@forethread/ui-components';
import CrossInCircleIcon from '@forethread/ui-components/assets/icons/cross-in-circle.svg?react';
import EditIcon from '@forethread/ui-components/assets/icons/edit.svg?react';
import EyeIcon from '@forethread/ui-components/assets/icons/eye-opened.svg?react';
import NewUserIcon from '@forethread/ui-components/assets/icons/new-user.svg?react';
import { useCallback, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

import { TABS, PAGE_SIZE_OPTIONS, type SortField } from '../constants';
import { ROLE_BADGE_COLORS, STATUS_TEXT_COLORS } from '../constants/roles';
import { useUserSort } from '../hooks/useUserSort';
import {
  useUsers,
  useDeactivateUser,
  useReactivateUser,
  useResendInvitation,
  useCancelInvitation,
  useResetUserPassword,
} from '../services/users.service';
import { useUsersStore } from '../state/users.store';

import { CreateUserModal } from './CreateUserModal';
import { EditUserModal } from './EditUserModal';
import { InvitationSuccessModal } from './InvitationSuccessModal';
import { ProjectAccessModal } from './ProjectAccessModal';

export default function UserListPage() {
  const { t } = useTranslation(['users', 'common']);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as (typeof TABS)[number] | null;
  const activeTab =
    tabParam && (TABS as readonly string[]).includes(tabParam) ? tabParam : 'companyUsers';
  const setActiveTab = useCallback(
    (tab: (typeof TABS)[number]) => setSearchParams({ tab }, { replace: true }),
    [setSearchParams],
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const { sortField, sortDir, handleSort: onSort } = useUserSort();
  const [projectAccessUser, setProjectAccessUser] = useState<{ id: string; name: string } | null>(
    null,
  );
  const {
    isCreateModalOpen,
    openCreateModal,
    closeCreateModal,
    isSuccessModalOpen,
    closeSuccessModal,
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
    sortBy: sortField ?? undefined,
    sortDir: sortDir ?? undefined,
  });

  const handleSort = (field: SortField) => {
    onSort(field);
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
        onClick: () => setProjectAccessUser({ id: user.id, name: user.name }),
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

  const sortableColumns: { field: SortField; label: string; className?: string }[] = [
    { field: 'name', label: t('columns.fullName'), className: 'px-6' },
    { field: 'email', label: t('columns.email') },
    { field: 'phone', label: t('columns.phone') },
    { field: 'role', label: t('columns.role') },
    { field: 'status', label: t('columns.status') },
  ];

  return (
    <div className="p-6">
      {/* Tabs */}
      <div className="flex gap-6 border-b border-border mb-6">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              'pb-3 text-sm font-medium transition-colors relative',
              activeTab === tab ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t(`tabs.${tab}` as 'tabs.companyUsers')}
            {activeTab === tab && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-foreground" />
            )}
          </button>
        ))}
      </div>

      {/* Content — Company users tab */}
      {activeTab === 'companyUsers' && (
        <div className="bg-card rounded-lg border border-border">
          {/* Invite user button */}
          <div className="flex justify-end px-6 pt-5 pb-4">
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
            <>
              <div className="mx-6 mb-6 border border-border rounded-lg overflow-x-auto">
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
                      <th className="px-4 py-3 text-left text-xs font-bold leading-4 tracking-[0.6px] cursor-pointer select-none">
                        <span className="flex items-center justify-between w-full">
                          {t('columns.projects')}
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
                        <td className="px-4 py-4 text-muted-foreground text-sm truncate">—</td>
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

              {data && (
                <div className="px-6">
                  <TablePagination
                    page={data.meta.page}
                    totalItems={data.meta.total}
                    pageSize={pageSize}
                    pageSizeOptions={PAGE_SIZE_OPTIONS}
                    onPageChange={setPage}
                    onPageSizeChange={setPageSize}
                    rowsPerPageLabel={t('common:rowsPerPage')}
                    showingLabel={({ from, to, total }) =>
                      t('common:showingItems', { from, to, total })
                    }
                    backLabel={t('common:back')}
                    nextLabel={t('common:next')}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Placeholder tabs */}
      {activeTab === 'approvalConfiguration' && (
        <div className="bg-card rounded-lg border border-border p-12 text-center text-muted-foreground">
          {t('tabs.approvalConfigurationPlaceholder')}
        </div>
      )}
      {activeTab === 'rolePermissions' && (
        <div className="bg-card rounded-lg border border-border p-12 text-center text-muted-foreground">
          {t('tabs.rolePermissionsPlaceholder')}
        </div>
      )}

      {isCreateModalOpen && <CreateUserModal onClose={closeCreateModal} />}
      {isSuccessModalOpen && <InvitationSuccessModal onClose={closeSuccessModal} />}
      {isEditModalOpen && <EditUserModal onClose={closeEditModal} />}
      {projectAccessUser && (
        <ProjectAccessModal
          userId={projectAccessUser.id}
          userName={projectAccessUser.name}
          currentProjectIds={[]}
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
    </div>
  );
}
