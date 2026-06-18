import {
  type UserResponse,
  deactivateUser as deactivateUserApi,
  reactivateUser as reactivateUserApi,
} from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { UserStatus } from '@forethread/shared-types/client';
import {
  cn,
  Button,
  Spinner,
  TablePagination,
  EmptyState,
  DotActionsMenu,
  FilterPopover,
  SortIcon,
  SearchInput,
  useDebounce,
  StatusActionModal,
  StatusSuccessModal,
  ResetPasswordSuccessModal,
  notificationService,
  type DotAction,
} from '@forethread/ui-components';
import ChevronRightIcon from '@forethread/ui-components/assets/icons/chevron-right.svg?react';
import CrossInCircleIcon from '@forethread/ui-components/assets/icons/cross-in-circle.svg?react';
import EditIcon from '@forethread/ui-components/assets/icons/edit.svg?react';
import EyeIcon from '@forethread/ui-components/assets/icons/eye-opened.svg?react';
import NewUserIcon from '@forethread/ui-components/assets/icons/new-user.svg?react';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';
import { useCompanies } from '@/features/companies/services/companies.service';

import { TABS, PAGE_SIZE_OPTIONS, type SortField } from '../constants';
import { ALL_ROLE_OPTIONS } from '../constants/roles';
import { useGroupedUsers } from '../hooks/useGroupedUsers';
import { useUserSort } from '../hooks/useUserSort';
import {
  useUsers,
  useDeactivateUser,
  useReactivateUser,
  useResendInvitation,
  useCancelInvitation,
  useInitiateResetPassword,
} from '../services/users.service';
import { useUsersStore } from '../state/users.store';

import { ActionLogTab } from './ActionLogTab';
import { CreateUserModal } from './CreateUserModal';
import { DateRangeFilterPopover } from './DateRangeFilterPopover';
import { EditUserModal } from './EditUserModal';
import { EditCompanyModal } from './modals/EditCompanyModal';

export default function UserListPage() {
  const { t } = useTranslation(['users', 'common']);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as (typeof TABS)[number] | null;
  const activeTab =
    tabParam && (TABS as readonly string[]).includes(tabParam) ? tabParam : 'platformUsers';
  const setActiveTab = useCallback(
    (tab: (typeof TABS)[number]) => setSearchParams({ tab }, { replace: true }),
    [setSearchParams],
  );
  // ── Local state ──
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const { sortField, sortDir, handleSort: onSort } = useUserSort();

  // Filter state
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Reset page when debounced search changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  // ── Store ──
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
    isEditCompanyModalOpen,
    openEditCompanyModal,
    isBulkActionModalOpen,
    bulkActionType,
    bulkActionCompanyName,
    bulkActionUserIds,
    openBulkActionModal,
    closeBulkActionModal,
    expandedCompanyIds,
    toggleCompany,
  } = useUsersStore();

  // ── Mutations ──
  const deactivateMutation = useDeactivateUser();
  const reactivateMutation = useReactivateUser();
  const resendMutation = useResendInvitation();
  const cancelInvitationMutation = useCancelInvitation();
  const resetPasswordMutation = useInitiateResetPassword();

  // ── Queries ──
  const { data, isLoading, isError } = useUsers({
    page,
    limit: pageSize,
    search: debouncedSearch || undefined,
    role: selectedRoles.length ? selectedRoles.join(',') : undefined,
    status: selectedStatuses.length ? selectedStatuses.join(',') : undefined,
    companyId: selectedCompanies.length ? selectedCompanies.join(',') : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    sortBy: sortField ?? undefined,
    sortDir: sortDir ?? undefined,
  });

  const { data: companiesData } = useCompanies({ limit: 100 });

  const groups = useGroupedUsers(data?.items, companiesData?.items);

  // ── Handlers ──
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

    // Note: "Edit" is the dedicated pencil icon on each row, so it is intentionally
    // omitted from the ⋮ menu here (matches Figma sa-popup-1).
    const actions: DotAction[] = [];

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

  const queryClient = useQueryClient();
  const [isBulkActionLoading, setIsBulkActionLoading] = useState(false);

  const handleBulkAction = async () => {
    if (!bulkActionType || !bulkActionUserIds.length || !bulkActionCompanyName) return;
    setIsBulkActionLoading(true);
    const apiFn = bulkActionType === 'deactivate' ? deactivateUserApi : reactivateUserApi;

    try {
      const results = await Promise.allSettled(bulkActionUserIds.map((id) => apiFn(id)));
      const failures = results.filter((r) => r.status === 'rejected');

      await queryClient.invalidateQueries({ queryKey: ['users'] });
      closeBulkActionModal();

      if (failures.length > 0 && failures.length < bulkActionUserIds.length) {
        notificationService.error(t('bulkActionPartialError'));
      } else if (failures.length === bulkActionUserIds.length) {
        notificationService.error(t('bulkActionPartialError'));
      } else {
        notificationService.success(
          bulkActionType === 'deactivate'
            ? t('bulkDeactivateSuccess', { company: bulkActionCompanyName })
            : t('bulkActivateSuccess', { company: bulkActionCompanyName }),
        );
      }
    } finally {
      setIsBulkActionLoading(false);
    }
  };

  const getCompanyActions = (
    companyId: string,
    companyName: string,
    companyUsers: UserResponse[],
  ): DotAction[] => {
    // Only consider users that can be toggled (not Invited)
    const toggleableUsers = companyUsers.filter((u) => u.status !== UserStatus.INVITED);
    const allInactive =
      toggleableUsers.length > 0 && toggleableUsers.every((u) => u.status === UserStatus.INACTIVE);

    return [
      {
        key: 'viewCompany',
        label: t('actions.viewCompanyDetails'),
        onClick: () => navigate(ROUTES.companyDetail.replace(':id', companyId)),
      },
      {
        key: 'editCompany',
        label: t('actions.editCompanyDetails'),
        onClick: () => openEditCompanyModal(companyId, companyName),
      },
      allInactive
        ? {
            key: 'activateAll',
            label: t('actions.activateAll'),
            onClick: () =>
              openBulkActionModal(
                'activate',
                companyName,
                toggleableUsers.map((u) => u.id),
              ),
          }
        : {
            key: 'deactivateAll',
            label: t('actions.deactivateAll'),
            onClick: () =>
              openBulkActionModal(
                'deactivate',
                companyName,
                toggleableUsers.filter((u) => u.status === UserStatus.ACTIVE).map((u) => u.id),
              ),
          },
    ];
  };

  // ── Filter options ──
  const companyOptions =
    companiesData?.items.map((c) => ({ value: c.id, label: c.legalName })) ?? [];
  const statusOptions = [
    { value: UserStatus.ACTIVE, label: t('statuses.ACTIVE') },
    { value: UserStatus.INACTIVE, label: t('statuses.INACTIVE') },
    { value: UserStatus.INVITED, label: t('statuses.INVITED') },
  ];
  const roleOptions = ALL_ROLE_OPTIONS.map((role) => ({
    value: role,
    label: String(t(`roles.${role}` as 'roles.COMPANY_ADMIN')),
  }));

  const sortableColumns: { field: SortField; label: string }[] = [
    { field: 'name', label: t('columns.fullName') },
    { field: 'email', label: t('columns.email') },
    { field: 'phone', label: t('columns.phone') },
    { field: 'role', label: t('columns.role') },
    { field: 'status', label: t('columns.status') },
    { field: 'dateJoined', label: t('columns.dateJoined') },
  ];

  return (
    <div className="flex flex-col gap-6 p-4">
      {/* ── Tabs ── */}
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
              {t(`tabs.${tab}` as 'tabs.platformUsers')}
            </button>
          );
        })}
      </div>

      {/* ── Platform users tab ── */}
      {activeTab === 'platformUsers' && (
        <div className="bg-card rounded-lg border border-border">
          {/* Toolbar: search + filters + invite */}
          <div className="flex items-center gap-3 px-4 pt-4 pb-4 flex-wrap">
            {/* Search */}
            <SearchInput
              className="flex-1 min-w-48 max-w-[450px]"
              iconClassName="text-foreground"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
            />

            {/* Filters */}
            <FilterPopover
              label={t('filters.company')}
              popoverTitle={t('filters.company')}
              searchable
              searchPlaceholder={t('filters.searchCompany')}
              clearLabel={t('filters.clear')}
              options={companyOptions}
              selected={selectedCompanies}
              onChange={(v) => {
                setSelectedCompanies(v);
                setPage(1);
              }}
            />
            <FilterPopover
              label={t('filters.status')}
              popoverTitle={t('filters.status')}
              clearLabel={t('filters.clear')}
              options={statusOptions}
              selected={selectedStatuses}
              onChange={(v) => {
                setSelectedStatuses(v);
                setPage(1);
              }}
            />
            <FilterPopover
              label={t('filters.role')}
              popoverTitle={t('filters.role')}
              clearLabel={t('filters.clear')}
              options={roleOptions}
              selected={selectedRoles}
              onChange={(v) => {
                setSelectedRoles(v);
                setPage(1);
              }}
            />
            <DateRangeFilterPopover
              label={t('filters.date')}
              popoverTitle={t('filters.date')}
              clearLabel={t('filters.clear')}
              dateFrom={dateFrom}
              dateTo={dateTo}
              fromPlaceholder={t('filters.from')}
              toPlaceholder={t('filters.to')}
              onChangeFrom={(d) => {
                setDateFrom(d);
                setPage(1);
              }}
              onChangeTo={(d) => {
                setDateTo(d);
                setPage(1);
              }}
              onClear={() => {
                setDateFrom('');
                setDateTo('');
                setPage(1);
              }}
            />

            {/* Invite button */}
            <Button onClick={openCreateModal} className="gap-2 ml-auto">
              <NewUserIcon className="w-4 h-4" />
              {t('inviteUser')}
            </Button>
          </div>

          {/* ── Table ── */}
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
              <EmptyState
                title={t('noUsersFound')}
                description={
                  debouncedSearch ||
                  selectedCompanies.length ||
                  selectedStatuses.length ||
                  selectedRoles.length ||
                  dateFrom ||
                  dateTo
                    ? t('adjustFilters')
                    : t('createFirstUser')
                }
              />
            </div>
          ) : (
            <>
              <div className="mx-4 mb-4 border border-border rounded-lg overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm table-fixed">
                  {/* Column headers */}
                  <thead>
                    <tr className="border-b border-border bg-[hsl(var(--table-header))] font-['Inter'] text-[hsl(var(--table-header-foreground))]">
                      {/* Expand/collapse spacer */}
                      <th className="w-10" />
                      {sortableColumns.map((col) => (
                        <th
                          key={col.field}
                          className="px-4 py-3 text-left text-xs font-bold leading-4 tracking-[0.6px] cursor-pointer select-none transition-colors"
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
                      <th className="w-[120px] px-4 py-3 text-right text-xs font-bold leading-4 tracking-[0.6px]">
                        {t('columns.actions')}
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {groups.map((group) => {
                      const isExpanded = expandedCompanyIds.includes(group.companyId);
                      return (
                        <CompanySection
                          key={group.companyId}
                          companyId={group.companyId}
                          companyName={group.companyName}
                          userCount={group.users.length}
                          isExpanded={isExpanded}
                          onToggle={() => toggleCompany(group.companyId)}
                          onEditCompany={() =>
                            openEditCompanyModal(group.companyId, group.companyName)
                          }
                          companyActions={getCompanyActions(
                            group.companyId,
                            group.companyName,
                            group.users,
                          )}
                        >
                          {isExpanded &&
                            group.users.map((user) => (
                              <UserRow
                                key={user.id}
                                user={user}
                                actions={getRowActions(user)}
                                onView={() => navigate(ROUTES.userDetail.replace(':id', user.id))}
                                onEdit={() => openEditModal(user.id)}
                              />
                            ))}
                        </CompanySection>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {data && data.meta.total > 10 && (
                <div className="px-4">
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

      {/* ── Action Log ── */}
      {activeTab === 'actionLog' && <ActionLogTab />}

      {/* ── Modals ── */}
      {isCreateModalOpen && <CreateUserModal onClose={closeCreateModal} />}
      {isEditModalOpen && <EditUserModal onClose={closeEditModal} />}
      {isEditCompanyModalOpen && <EditCompanyModal />}

      {/* Status Action Modal (activate/deactivate) */}
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

      {/* Reset Password Success Modal */}
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

      {/* Status Success Modal (activate/deactivate) */}
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

      {/* Bulk Action Modal (deactivate/activate all company users) */}
      {isBulkActionModalOpen && bulkActionType && (
        <StatusActionModal
          onClose={closeBulkActionModal}
          onConfirm={() => void handleBulkAction()}
          isLoading={isBulkActionLoading}
          title={t(
            `bulk${bulkActionType === 'deactivate' ? 'Deactivate' : 'Activate'}Modal.title` as 'bulkDeactivateModal.title',
          )}
          subtitle={t(
            `bulk${bulkActionType === 'deactivate' ? 'Deactivate' : 'Activate'}Modal.subtitle` as 'bulkDeactivateModal.subtitle',
          )}
          infoText={
            <span
              dangerouslySetInnerHTML={{
                __html: t(
                  `bulk${bulkActionType === 'deactivate' ? 'Deactivate' : 'Activate'}Modal.info` as 'bulkDeactivateModal.info',
                  {
                    company: bulkActionCompanyName ?? '',
                    interpolation: { escapeValue: false },
                  },
                ),
              }}
            />
          }
          confirmLabel={t(
            `bulk${bulkActionType === 'deactivate' ? 'Deactivate' : 'Activate'}Modal.confirm` as 'bulkDeactivateModal.confirm',
          )}
          cancelLabel={t('common:cancel')}
          variant={bulkActionType === 'deactivate' ? 'danger' : 'default'}
          icon={
            bulkActionType === 'deactivate' ? (
              <CrossInCircleIcon className="w-6 h-6 text-foreground" />
            ) : undefined
          }
        />
      )}

      {/* Cancel Invitation Modal */}
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

/* ── Company group header + children rows ── */
interface CompanySectionProps {
  companyId: string;
  companyName: string;
  userCount: number;
  isExpanded: boolean;
  onToggle: () => void;
  onEditCompany: () => void;
  companyActions: DotAction[];
  children: React.ReactNode;
}

function CompanySection({
  companyId,
  companyName,
  userCount,
  isExpanded,
  onToggle,
  onEditCompany,
  companyActions,
  children,
}: CompanySectionProps) {
  const { t } = useTranslation('users');
  const navigate = useNavigate();

  return (
    <>
      {/* Company header row */}
      <tr
        className="border-b border-border last:border-b-0 bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
        onClick={onToggle}
      >
        <td className="px-3 py-3">
          <ChevronRightIcon
            className={cn(
              'w-4 h-4 text-muted-foreground transition-transform',
              isExpanded && 'rotate-90',
            )}
          />
        </td>
        <td colSpan={6} className="px-4 py-3">
          <span className="font-['Arial'] font-normal text-sm leading-5 text-foreground">
            {companyName}
          </span>
          <span className="ml-2 text-xs text-muted-foreground">
            ({t('groupedTable.users', { count: userCount })})
          </span>
        </td>
        <td className="px-4 py-3">
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              aria-label="View company"
              onClick={() => navigate(ROUTES.companyDetail.replace(':id', companyId))}
            >
              <EyeIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Edit company"
              onClick={onEditCompany}
            >
              <EditIcon className="w-4 h-4" />
            </button>
            <DotActionsMenu actions={companyActions} bordered={false} />
          </div>
        </td>
      </tr>

      {/* User rows */}
      {children}
    </>
  );
}

/* ── Single user row ── */
interface UserRowProps {
  user: UserResponse;
  actions: DotAction[];
  onView: () => void;
  onEdit: () => void;
}

function UserRow({ user, actions, onView, onEdit }: UserRowProps) {
  const { t } = useTranslation('users');

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  return (
    <tr className="border-b border-border last:border-b-0 hover:bg-accent/50 transition-colors">
      {/* Spacer for indent */}
      <td />
      <td className="px-4 py-3 text-foreground">{user.name}</td>
      <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
      <td className="px-4 py-3 text-muted-foreground">{user.phone ?? '—'}</td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center rounded-full bg-[hsl(var(--badge-neutral))] px-2 py-1 text-xs text-[hsl(var(--badge-neutral-text))]">
          {t(`roles.${user.role}` as 'roles.COMPANY_ADMIN')}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center rounded-full border border-border bg-secondary px-2 py-1 text-xs text-[hsl(var(--badge-neutral-text))]">
          {t(`statuses.${user.status}` as 'statuses.ACTIVE')}
        </span>
      </td>
      <td className="px-4 py-3 text-muted-foreground text-sm">{formatDate(user.createdAt)}</td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            aria-label="View"
            onClick={onView}
          >
            <EyeIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Edit"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            <EditIcon className="w-4 h-4" />
          </button>
          <DotActionsMenu actions={actions} bordered={false} />
        </div>
      </td>
    </tr>
  );
}
