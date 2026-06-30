import {
  type UserResponse,
  deactivateUser as deactivateUserApi,
  reactivateUser as reactivateUserApi,
} from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { usePageTitleStore } from '@forethread/rfq-shared';
import { CompanyType, UserRole, UserStatus } from '@forethread/shared-types/client';
import {
  cn,
  Button,
  Spinner,
  Tabs,
  TablePagination,
  EmptyState,
  EmptyBoxIllustration,
  SearchEmptyIllustration,
  DotActionsMenu,
  FilterPopover,
  FilterTag,
  SortIcon,
  SearchInput,
  useDebounce,
  StatusActionModal,
  StatusSuccessModal,
  ResetPasswordSuccessModal,
  notificationService,
  type DotAction,
  type TabItem,
} from '@forethread/ui-components';
import ChevronRightIcon from '@forethread/ui-components/assets/icons/chevron-right.svg?react';
import ClockIcon from '@forethread/ui-components/assets/icons/clock.svg?react';
import CrossInCircleIcon from '@forethread/ui-components/assets/icons/cross-in-circle.svg?react';
import CrossIcon from '@forethread/ui-components/assets/icons/cross.svg?react';
import DepartmentIcon from '@forethread/ui-components/assets/icons/department.svg?react';
import EditIcon from '@forethread/ui-components/assets/icons/edit.svg?react';
import EyeIcon from '@forethread/ui-components/assets/icons/eye-opened.svg?react';
import NewUserIcon from '@forethread/ui-components/assets/icons/new-user.svg?react';
import ShieldIcon from '@forethread/ui-components/assets/icons/shield-icon.svg?react';
import SuppliersIcon from '@forethread/ui-components/assets/icons/suppliers.svg?react';
import UsersGroupIcon from '@forethread/ui-components/assets/icons/users-group.svg?react';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';
import { useCompanies } from '@/features/companies/services/companies.service';

import { RoleBadge, StatusBadge } from '../../shared/userBadges';
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
import { AddSuperAdminModal } from './AddSuperAdminModal';
import { CreateUserModal } from './CreateUserModal';
import { DateRangeFilterPopover } from './DateRangeFilterPopover';
import { EditUserModal } from './EditUserModal';
import { AddContractorCompanyModal } from './modals/AddContractorCompanyModal';
import { AddVendorCompanyModal } from './modals/AddVendorCompanyModal';
import { CreateCompanyChooserModal } from './modals/CreateCompanyChooserModal';
import { EditCompanyModal } from './modals/EditCompanyModal';

/* ── Shared design-system control styles ── */
/** 28px gradient-white bordered icon button (row-level actions). */
const ICON_BTN_28 =
  'flex size-7 shrink-0 items-center justify-center rounded-[8px] border border-gray-100 bg-gradient-to-b from-[#F9F9FA] to-white text-gray-600 shadow-[0_1px_6px_0_rgba(10,13,18,0.06),0_1px_2px_0_rgba(10,13,18,0.02)] transition-colors hover:bg-none hover:bg-gray-50 hover:text-gray-900';
/** 34px ghost icon button (company-card header actions). */
const ICON_BTN_34 =
  'flex size-[34px] shrink-0 items-center justify-center rounded-[12px] text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900';
/** Gradient-white count pill (e.g. "N users"). */
const COUNT_PILL =
  'inline-flex h-6 items-center rounded-[8px] border border-gray-100 bg-gradient-to-b from-[#F9F9FA] to-white px-[7px] text-xs font-medium text-gray-700 shadow-[0_1px_3px_0_rgba(10,13,18,0.06),0_1px_1px_0_rgba(10,13,18,0.02)]';

export default function UserListPage() {
  const { t } = useTranslation(['users', 'common']);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as (typeof TABS)[number] | null;
  const activeTab =
    tabParam && (TABS as readonly string[]).includes(tabParam) ? tabParam : 'platformUsers';

  // ── Local state ──
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const { sortField, sortDir, handleSort: onSort } = useUserSort();
  const [isCreateCompanyOpen, setIsCreateCompanyOpen] = useState(false);
  const [createCompanyType, setCreateCompanyType] = useState<CompanyType | null>(null);

  const setActiveTab = useCallback(
    (tab: (typeof TABS)[number]) => {
      setSearchParams({ tab }, { replace: true });
      setPage(1);
    },
    [setSearchParams],
  );

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

  // App-bar breadcrumb / page title
  const setPageTitle = usePageTitleStore((s) => s.setTitle);
  useEffect(() => {
    setPageTitle(t('userManagement'), null, null, [{ label: t('userManagement') }]);
  }, [setPageTitle, t]);

  // ── Store ──
  const {
    isCreateModalOpen,
    openCreateModal,
    closeCreateModal,
    isCreateSuperAdminModalOpen,
    openCreateSuperAdminModal,
    closeCreateSuperAdminModal,
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

  // The Vendors tab is the platform-users view scoped to the VENDOR role.
  const isVendorsTab = activeTab === 'vendors';
  const isTableTab = activeTab === 'platformUsers' || activeTab === 'vendors';

  // ── Queries ──
  const { data, isLoading, isError } = useUsers({
    page,
    limit: pageSize,
    search: debouncedSearch || undefined,
    role: isVendorsTab
      ? UserRole.VENDOR
      : selectedRoles.length
        ? selectedRoles.join(',')
        : undefined,
    status: selectedStatuses.length ? selectedStatuses.join(',') : undefined,
    companyId: selectedCompanies.length ? selectedCompanies.join(',') : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    sortBy: sortField ?? undefined,
    sortDir: sortDir ?? undefined,
  });

  const { data: companiesData } = useCompanies({ limit: 100 });

  const groups = useGroupedUsers(data?.items, companiesData?.items);

  const total = data?.meta.total ?? 0;
  const hasActiveFilters = Boolean(
    debouncedSearch ||
    selectedCompanies.length ||
    selectedStatuses.length ||
    (!isVendorsTab && selectedRoles.length) ||
    dateFrom ||
    dateTo,
  );

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

  // ── Active-filter chips + toolbar summary (shown when filters are applied) ──
  const formatChipDate = (value: string) =>
    new Date(value).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  const dateChipLabel =
    dateFrom && dateTo
      ? `${formatChipDate(dateFrom)} - ${formatChipDate(dateTo)}`
      : dateFrom
        ? `${t('filters.from')}: ${formatChipDate(dateFrom)}`
        : dateTo
          ? `${t('filters.to')}: ${formatChipDate(dateTo)}`
          : '';

  const activeFilterChips: { key: string; label: string; onRemove: () => void }[] = [
    ...selectedStatuses.map((value) => ({
      key: `status-${value}`,
      label: statusOptions.find((o) => (o.value as string) === value)?.label ?? value,
      onRemove: () => {
        setSelectedStatuses((prev) => prev.filter((v) => v !== value));
        setPage(1);
      },
    })),
    ...(isVendorsTab
      ? []
      : selectedRoles.map((value) => ({
          key: `role-${value}`,
          label: roleOptions.find((o) => (o.value as string) === value)?.label ?? value,
          onRemove: () => {
            setSelectedRoles((prev) => prev.filter((v) => v !== value));
            setPage(1);
          },
        }))),
    ...selectedCompanies.map((value) => ({
      key: `company-${value}`,
      label: companyOptions.find((o) => o.value === value)?.label ?? value,
      onRemove: () => {
        setSelectedCompanies((prev) => prev.filter((v) => v !== value));
        setPage(1);
      },
    })),
    ...(dateFrom || dateTo
      ? [
          {
            key: 'date-range',
            label: dateChipLabel,
            onRemove: () => {
              setDateFrom('');
              setDateTo('');
              setPage(1);
            },
          },
        ]
      : []),
  ];

  const handleClearAllFilters = () => {
    setSelectedStatuses([]);
    setSelectedRoles([]);
    setSelectedCompanies([]);
    setDateFrom('');
    setDateTo('');
    setSearch('');
    setPage(1);
  };

  // Toolbar summary text: search query → "Searching result: N"; other filters →
  // "Showing N users"; otherwise the resting "Total users: N".
  const countLabel = debouncedSearch
    ? t('searchingResultLabel', { total })
    : hasActiveFilters
      ? t('showingUsersLabel', { total })
      : t('totalUsersLabel', { total });

  const tabItems: TabItem<(typeof TABS)[number]>[] = [
    {
      value: 'platformUsers',
      label: t('tabs.platformUsers'),
      icon: <UsersGroupIcon className="size-[18px]" />,
    },
    { value: 'vendors', label: t('tabs.vendors'), icon: <SuppliersIcon className="size-[18px]" /> },
    { value: 'actionLog', label: t('tabs.actionLog'), icon: <ClockIcon className="size-[18px]" /> },
  ];

  return (
    <div className="flex flex-1 flex-col gap-3 px-6 py-4">
      {/* ── Page header + tabs ── */}
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-[8px] border border-gray-100 bg-gradient-to-b from-[#F9F9FA] to-white p-px text-gray-700 shadow-[0_1px_3px_0_rgba(10,13,18,0.06),0_1px_1px_0_rgba(10,13,18,0.02)]">
              <UsersGroupIcon className="size-[15px]" />
            </span>
            <h1 className="text-[20px] font-medium leading-[1.4] tracking-[0.3px] text-gray-900">
              {t('userManagement')}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={openCreateModal} leftIcon={<NewUserIcon className="size-4" />}>
              {t('inviteUser')}
            </Button>
            <Button
              variant="secondary"
              onClick={openCreateSuperAdminModal}
              leftIcon={<ShieldIcon className="size-4" />}
            >
              {t('addSuperAdmin')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => setIsCreateCompanyOpen(true)}
              leftIcon={<DepartmentIcon className="size-4" />}
            >
              {t('createCompany')}
            </Button>
          </div>
        </div>

        <Tabs items={tabItems} value={activeTab} onValueChange={setActiveTab} />
      </div>

      {/* ── Action Log tab ── */}
      {activeTab === 'actionLog' && <ActionLogTab />}

      {/* ── Platform users / Vendors tab ── */}
      {isTableTab && (
        <div className="flex flex-1 flex-col gap-4 rounded-[18px] border border-gray-100 bg-[#F9F9FA] p-3 shadow-[0_1px_6px_0_rgba(10,13,18,0.06),0_1px_2px_0_rgba(10,13,18,0.02)]">
          {/* Toolbar */}
          <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-2">
            {/* Left: result count, Clear all, and active-filter chips */}
            <div className="flex min-h-[34px] min-w-0 flex-1 flex-wrap items-center gap-2 px-2">
              <p className="text-sm font-medium leading-[1.4] tracking-[0.3px] text-gray-700">
                {countLabel}
              </p>
              {hasActiveFilters && (
                <Button
                  variant="secondary"
                  size="sm"
                  rightIcon={<CrossIcon className="size-3.5" />}
                  onClick={handleClearAllFilters}
                >
                  {t('filters.clearAll')}
                </Button>
              )}
              {activeFilterChips.map((chip) => (
                <FilterTag
                  key={chip.key}
                  label={chip.label}
                  onRemove={chip.onRemove}
                  removeLabel={t('filters.removeFilter', { label: chip.label })}
                />
              ))}
            </div>
            {/* Right: filter dropdowns + search */}
            <div className="flex min-h-[34px] flex-wrap items-center justify-end gap-2">
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
              {!isVendorsTab && (
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
              )}
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
              <SearchInput
                className="w-[220px]"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('searchPlaceholder')}
              />
            </div>
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="flex h-48 items-center justify-center">
              <Spinner size="md" />
            </div>
          ) : isError ? (
            <div className="flex h-48 items-center justify-center text-sm text-destructive">
              {t('failedToLoad')}
            </div>
          ) : total === 0 ? (
            <div className="flex flex-1 items-center justify-center rounded-[10px] border border-gray-100 bg-white shadow-[0_1px_6px_0_rgba(10,13,18,0.06),0_1px_2px_0_rgba(10,13,18,0.02)]">
              {hasActiveFilters ? (
                <EmptyState
                  illustration={<SearchEmptyIllustration />}
                  titleClassName="text-[24px]"
                  title={t('noResultsTitle')}
                  description={
                    debouncedSearch
                      ? t('noResultsDescriptionQuery', { query: debouncedSearch })
                      : t('noResultsDescription')
                  }
                />
              ) : (
                <EmptyState
                  illustration={<EmptyBoxIllustration />}
                  title={t('noUsersFound')}
                  description={t('emptyDescription')}
                />
              )}
            </div>
          ) : (
            <div className="flex flex-1 flex-col gap-1.5">
              {groups.map((group) => (
                <CompanyCard
                  key={group.companyId}
                  companyId={group.companyId}
                  companyName={group.companyName}
                  userCount={group.users.length}
                  isExpanded={expandedCompanyIds.includes(group.companyId)}
                  onToggle={() => toggleCompany(group.companyId)}
                  onViewCompany={() =>
                    navigate(ROUTES.companyDetail.replace(':id', group.companyId))
                  }
                  companyActions={getCompanyActions(
                    group.companyId,
                    group.companyName,
                    group.users,
                  )}
                >
                  <UserTable
                    users={group.users}
                    sortField={sortField}
                    sortDir={sortDir}
                    onSort={handleSort}
                    getRowActions={getRowActions}
                    onView={(id) => navigate(ROUTES.userDetail.replace(':id', id))}
                    onEdit={(id) => openEditModal(id)}
                  />
                </CompanyCard>
              ))}

              {data && data.meta.total > 10 && (
                <div className="pt-1">
                  <TablePagination
                    page={data.meta.page}
                    totalItems={data.meta.total}
                    pageSize={pageSize}
                    pageSizeOptions={PAGE_SIZE_OPTIONS}
                    onPageChange={setPage}
                    onPageSizeChange={setPageSize}
                    rowsPerPageLabel={t('common:rowsPerPage')}
                    showingLabel={({ from, to, total: tot }) =>
                      t('common:showingItems', { from, to, total: tot })
                    }
                    backLabel={t('common:back')}
                    nextLabel={t('common:next')}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Modals ── */}
      {isCreateModalOpen && <CreateUserModal onClose={closeCreateModal} />}
      {isCreateSuperAdminModalOpen && <AddSuperAdminModal onClose={closeCreateSuperAdminModal} />}
      {isEditModalOpen && <EditUserModal onClose={closeEditModal} />}
      {isEditCompanyModalOpen && <EditCompanyModal />}
      {/* Create company: pick a company type, then open the matching Add modal */}
      {isCreateCompanyOpen && (
        <CreateCompanyChooserModal
          onClose={() => setIsCreateCompanyOpen(false)}
          onSelect={(type) => {
            setIsCreateCompanyOpen(false);
            setCreateCompanyType(type);
          }}
        />
      )}
      {createCompanyType === CompanyType.CONTRACTOR && (
        <AddContractorCompanyModal
          onClose={() => setCreateCompanyType(null)}
          onSuccess={() => {
            setCreateCompanyType(null);
            void queryClient.invalidateQueries({ queryKey: ['companies'] });
            notificationService.success(
              t('addCompanyModal.createSuccess', 'Company created successfully'),
            );
          }}
        />
      )}
      {createCompanyType === CompanyType.VENDOR && (
        <AddVendorCompanyModal
          onClose={() => setCreateCompanyType(null)}
          onSuccess={() => {
            setCreateCompanyType(null);
            void queryClient.invalidateQueries({ queryKey: ['companies'] });
            notificationService.success(
              t('addCompanyModal.createSuccess', 'Company created successfully'),
            );
          }}
        />
      )}

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
              <CrossInCircleIcon className="h-6 w-6 text-foreground" />
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
              <CrossInCircleIcon className="h-6 w-6 text-foreground" />
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
          icon={<CrossInCircleIcon className="h-6 w-6 text-foreground" />}
        />
      )}
    </div>
  );
}

/* ── Company group card (header + expandable user table) ── */
interface CompanyCardProps {
  companyId: string;
  companyName: string;
  userCount: number;
  isExpanded: boolean;
  onToggle: () => void;
  onViewCompany: () => void;
  companyActions: DotAction[];
  children: React.ReactNode;
}

function CompanyCard({
  companyName,
  userCount,
  isExpanded,
  onToggle,
  onViewCompany,
  companyActions,
  children,
}: CompanyCardProps) {
  const { t } = useTranslation('users');
  const initial = companyName.trim().charAt(0).toUpperCase() || '?';

  return (
    <div className="overflow-hidden rounded-[10px] border border-gray-100 bg-white shadow-[0_1px_6px_0_rgba(10,13,18,0.06),0_1px_2px_0_rgba(10,13,18,0.02)]">
      {/* Header (clickable to expand/collapse) */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        className="flex cursor-pointer items-center gap-4 p-1.5"
        onClick={onToggle}
        aria-expanded={isExpanded}
      >
        <span className={ICON_BTN_34}>
          <ChevronRightIcon
            className={cn('size-4 transition-transform', isExpanded && 'rotate-90')}
          />
        </span>

        <div className="flex flex-1 items-center gap-4">
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-white bg-gray-100 text-xs font-semibold text-gray-600 shadow-[0_1px_2px_0_rgba(10,13,18,0.06)]">
              {initial}
            </span>
            <span className="text-sm font-semibold text-gray-900">{companyName}</span>
          </div>
          <span className={COUNT_PILL}>{t('groupedTable.users', { count: userCount })}</span>
        </div>

        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
        <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={onViewCompany}
            aria-label="View company"
            className={ICON_BTN_34}
          >
            <EyeIcon className="size-4" />
          </button>
          <DotActionsMenu
            actions={companyActions}
            bordered={false}
            triggerClassName={ICON_BTN_34}
          />
        </div>
      </div>

      {/* Expanded user table */}
      {isExpanded && userCount > 0 && children}
      {isExpanded && userCount === 0 && (
        <p className="border-t border-gray-50 px-4 py-6 text-center text-sm text-gray-500">
          {t('groupedTable.noUsersInCompany', 'No users in this company yet.')}
        </p>
      )}
    </div>
  );
}

/* ── User table (header + rows) inside a company card ── */
interface UserTableProps {
  users: UserResponse[];
  sortField: SortField | null;
  sortDir: 'asc' | 'desc' | null;
  onSort: (field: SortField) => void;
  getRowActions: (user: UserResponse) => DotAction[];
  onView: (id: string) => void;
  onEdit: (id: string) => void;
}

function UserTable({
  users,
  sortField,
  sortDir,
  onSort,
  getRowActions,
  onView,
  onEdit,
}: UserTableProps) {
  const { t } = useTranslation('users');

  const columns: { field: SortField; label: string }[] = [
    { field: 'name', label: t('columns.fullName') },
    { field: 'email', label: t('columns.email') },
    { field: 'phone', label: t('columns.phone') },
    { field: 'role', label: t('columns.role') },
    { field: 'status', label: t('columns.status') },
    { field: 'dateJoined', label: t('columns.dateJoined') },
  ];

  return (
    <div className="border-t border-gray-50 p-2">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] table-fixed border-collapse text-sm">
          <colgroup>
            <col />
            <col className="w-[190px]" />
            <col className="w-[150px]" />
            <col className="w-[180px]" />
            <col className="w-[128px]" />
            <col className="w-[120px]" />
            <col className="w-[104px]" />
          </colgroup>
          <thead>
            <tr className="border-b border-gray-100 bg-[#F9F9FA]">
              {columns.map((col) => (
                <th key={col.field} className="h-9 px-2 text-left align-middle">
                  <button
                    type="button"
                    onClick={() => onSort(col.field)}
                    className="inline-flex items-center gap-1 px-1 font-semibold text-gray-500 transition-colors hover:text-gray-700"
                  >
                    {col.label}
                    <SortIcon
                      active={sortField === col.field}
                      direction={sortField === col.field ? sortDir : null}
                    />
                  </button>
                </th>
              ))}
              <th className="h-9 px-2 text-left align-middle">
                <span className="px-1 font-semibold text-gray-500">{t('columns.actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                actions={getRowActions(user)}
                onView={() => onView(user.id)}
                onEdit={() => onEdit(user.id)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
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
    <tr className="border-b border-gray-50 transition-colors last:border-0 hover:bg-gray-25">
      <td className="h-[46px] px-2 align-middle">
        <span className="block truncate px-1 font-medium text-gray-800">{user.name}</span>
      </td>
      <td className="px-2 align-middle">
        <span className="block truncate px-1 font-medium text-gray-800">{user.email}</span>
      </td>
      <td className="px-2 align-middle">
        <span className="block truncate px-1 font-medium text-gray-800">{user.phone ?? '—'}</span>
      </td>
      <td className="px-2 align-middle">
        <RoleBadge role={user.role} label={t(`roles.${user.role}` as 'roles.COMPANY_ADMIN')} />
      </td>
      <td className="px-2 align-middle">
        <StatusBadge
          status={user.status}
          label={t(`statuses.${user.status}` as 'statuses.ACTIVE')}
        />
      </td>
      <td className="px-2 align-middle">
        <span className="block truncate px-1 font-medium text-gray-800">
          {formatDate(user.createdAt)}
        </span>
      </td>
      <td className="px-2 align-middle">
        <div className="flex items-center gap-1">
          <button type="button" onClick={onView} aria-label="View" className={ICON_BTN_28}>
            <EyeIcon className="size-3.5" />
          </button>
          <button type="button" onClick={onEdit} aria-label="Edit" className={ICON_BTN_28}>
            <EditIcon className="size-3.5" />
          </button>
          <DotActionsMenu actions={actions} bordered={false} triggerClassName={ICON_BTN_28} />
        </div>
      </td>
    </tr>
  );
}
