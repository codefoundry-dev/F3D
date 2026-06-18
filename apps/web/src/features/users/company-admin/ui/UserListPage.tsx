import type { UserResponse } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { usePageTitleStore } from '@forethread/rfq-shared';
import { UserStatus } from '@forethread/shared-types/client';
import {
  cn,
  Button,
  Spinner,
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
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

import { TABS, PAGE_SIZE_OPTIONS, type SortField } from '../constants';
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
  const setPageTitle = usePageTitleStore((s) => s.setTitle);
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

  // Surface the page title + subtitle in the global app header (per Figma every
  // screen shows its title there). Back-arrow returns to Settings.
  useEffect(() => {
    setPageTitle(t('userManagement'), t('userManagementSubtitle'), ROUTES.settings);
    return () => setPageTitle(null);
  }, [setPageTitle, t]);

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

  const headerCellClass =
    'p-3 text-left text-xs font-bold tracking-[0.6px] text-[hsl(var(--table-header-foreground))]';

  /** A sortable column header — label + sort arrows, matches the Figma table head. */
  const renderSortHeader = (field: SortField, label: string, className?: string) => (
    <th className={cn(headerCellClass, className)}>
      <button
        type="button"
        onClick={() => handleSort(field)}
        className="flex w-full select-none items-center justify-between gap-2"
      >
        {label}
        <SortIcon active={sortField === field} direction={sortField === field ? sortDir : null} />
      </button>
    </th>
  );

  /** A non-sortable header. `decorative` shows the static sort glyph (per Figma). */
  const renderPlainHeader = (label: string, className?: string, decorative?: boolean) => (
    <th className={cn(headerCellClass, className)}>
      <span className="flex w-full items-center justify-between gap-2">
        {label}
        {decorative && <SortIcon />}
      </span>
    </th>
  );

  return (
    <div className="flex flex-col gap-6 p-4">
      {/* Tabs */}
      <div className="flex items-start border-b border-[#c9c9c9]">
        {TABS.map((tab) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                '-mb-px border-b-2 p-3 text-lg font-medium leading-4 transition-colors',
                isActive
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-[#686868] hover:text-foreground',
              )}
            >
              {t(`tabs.${tab}` as 'tabs.companyUsers')}
            </button>
          );
        })}
      </div>

      {/* Content — Company users tab */}
      {activeTab === 'companyUsers' && (
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
          {/* Invite user */}
          <div className="flex items-center justify-end">
            <Button
              onClick={openCreateModal}
              className="h-[42px] gap-1.5 rounded-xl px-3 text-base"
            >
              <NewUserIcon className="h-[18px] w-[18px]" />
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
            <div className="py-12">
              <EmptyState title={t('noUsersFound')} description={t('createFirstUser')} />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[900px] table-fixed text-sm">
                  <thead>
                    <tr className="bg-[hsl(var(--table-header))]">
                      {renderSortHeader('name', t('columns.fullName'), 'w-[200px]')}
                      {renderSortHeader('email', t('columns.email'))}
                      {renderPlainHeader(t('columns.phone'))}
                      {renderSortHeader('role', t('columns.role'), 'w-[180px]')}
                      {renderSortHeader('status', t('columns.status'), 'w-[156px]')}
                      {renderPlainHeader(t('columns.projects'), undefined, true)}
                      {renderPlainHeader(t('columns.actions'), 'w-[120px]')}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[rgba(0,0,0,0.08)]">
                    {data.items.map((user) => {
                      const projectNames = user.projects?.length
                        ? user.projects.map((p) => p.name).join(', ')
                        : null;
                      return (
                        <tr key={user.id} className="h-11 transition-colors hover:bg-accent/40">
                          <td className="p-3 text-foreground">{user.name}</td>
                          <td className="p-3 text-foreground">{user.email}</td>
                          <td className="p-3 text-foreground">{user.phone ?? '—'}</td>
                          <td className="p-3">
                            <span className="inline-flex items-center rounded-full bg-[hsl(var(--badge-neutral))] px-2 py-1 text-xs text-[hsl(var(--badge-neutral-text))]">
                              {t(`roles.${user.role}` as 'roles.COMPANY_ADMIN')}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className="inline-flex items-center rounded-full border border-border bg-secondary px-2 py-1 text-xs text-[hsl(var(--badge-neutral-text))]">
                              {t(`statuses.${user.status}` as 'statuses.ACTIVE')}
                            </span>
                          </td>
                          <td className="p-3 text-foreground">
                            <span className="block truncate">{projectNames ?? '—'}</span>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center justify-center gap-3 text-foreground">
                              <button
                                type="button"
                                className="transition-colors hover:text-foreground/60"
                                aria-label="View"
                                onClick={() => navigate(ROUTES.userDetail.replace(':id', user.id))}
                              >
                                <EyeIcon className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                className="transition-colors hover:text-foreground/60"
                                aria-label="Edit"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditModal(user.id);
                                }}
                              >
                                <EditIcon className="h-4 w-4" />
                              </button>
                              <DotActionsMenu actions={getRowActions(user)} bordered={false} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {data && (
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
              )}
            </>
          )}
        </div>
      )}

      {/* Placeholder tabs */}
      {activeTab === 'approvalConfiguration' && (
        <div className="rounded-lg border border-border bg-card p-12 text-center text-muted-foreground">
          {t('tabs.approvalConfigurationPlaceholder')}
        </div>
      )}
      {activeTab === 'rolePermissions' && (
        <div className="rounded-lg border border-border bg-card p-12 text-center text-muted-foreground">
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
    </div>
  );
}
