import type { UserResponse } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { usePageTitleStore } from '@forethread/rfq-shared';
import { UserStatus } from '@forethread/shared-types/client';
import {
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
  DateRangeFilterDropdown,
  SearchInput,
  SortIcon,
  useDebounce,
  StatusActionModal,
  StatusSuccessModal,
  ResetPasswordSuccessModal,
  notificationService,
  type DotAction,
  type TabItem,
} from '@forethread/ui-components';
import CrossInCircleIcon from '@forethread/ui-components/assets/icons/cross-in-circle.svg?react';
import CrossIcon from '@forethread/ui-components/assets/icons/cross.svg?react';
import EditIcon from '@forethread/ui-components/assets/icons/edit.svg?react';
import EyeIcon from '@forethread/ui-components/assets/icons/eye-opened.svg?react';
import NewUserIcon from '@forethread/ui-components/assets/icons/new-user.svg?react';
import SettingsIcon from '@forethread/ui-components/assets/icons/settings.svg?react';
import ShieldIcon from '@forethread/ui-components/assets/icons/shield-icon.svg?react';
import UsersGroupIcon from '@forethread/ui-components/assets/icons/users-group.svg?react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

import { RoleBadge, StatusBadge } from '../../shared/userBadges';
import {
  TABS,
  PAGE_SIZE_OPTIONS,
  COMPANY_ROLE_OPTIONS,
  STATUS_OPTIONS,
  type SortField,
} from '../constants';
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

/* ── Shared design-system control styles ── */
/** 28px gradient-white bordered icon button (row-level actions). */
const ICON_BTN_28 =
  'flex size-7 shrink-0 items-center justify-center rounded-[8px] border border-gray-100 bg-gradient-to-b from-[#F9F9FA] to-white text-gray-600 shadow-[0_1px_6px_0_rgba(10,13,18,0.06),0_1px_2px_0_rgba(10,13,18,0.02)] transition-colors hover:bg-none hover:bg-gray-50 hover:text-gray-900';

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

  // ── Toolbar filter state (mirrors the super-admin users list) ──
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Reset to the first page whenever the debounced search changes.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);
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

  // Surface the page title in the global app bar via a breadcrumb trail
  // (breadcrumbs are app-wide now — no back-arrow).
  useEffect(() => {
    setPageTitle(t('userManagement'), null, null, [{ label: t('userManagement') }]);
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
    search: debouncedSearch || undefined,
    role: selectedRoles.length ? selectedRoles.join(',') : undefined,
    status: selectedStatuses.length ? selectedStatuses.join(',') : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    sortBy: sortField ?? undefined,
    sortDir: sortDir ?? undefined,
  });

  const total = data?.meta.total ?? 0;
  const hasActiveFilters = Boolean(
    debouncedSearch || selectedStatuses.length || selectedRoles.length || dateFrom || dateTo,
  );

  const handleSort = (field: SortField) => {
    onSort(field);
    setPage(1);
  };

  // ── Filter options ──
  const statusOptions = STATUS_OPTIONS.map((s) => ({
    value: s,
    label: t(`statuses.${s}` as 'statuses.ACTIVE'),
  }));
  const roleOptions = COMPANY_ROLE_OPTIONS.map((r) => ({
    value: r,
    label: String(t(`roles.${r}` as 'roles.COMPANY_ADMIN')),
  }));

  // ── Active-filter chips ──
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
    ...selectedRoles.map((value) => ({
      key: `role-${value}`,
      label: roleOptions.find((o) => (o.value as string) === value)?.label ?? value,
      onRemove: () => {
        setSelectedRoles((prev) => prev.filter((v) => v !== value));
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
    setDateFrom('');
    setDateTo('');
    setSearch('');
    setPage(1);
  };

  const countLabel = debouncedSearch
    ? t('searchingResultLabel', { total })
    : hasActiveFilters
      ? t('showingUsersLabel', { total })
      : t('totalUsersLabel', { total });

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

  /** A sortable column header — label + sort arrows, matches the anchor table head. */
  const renderSortHeader = (field: SortField, label: string) => (
    <th className="h-9 px-2 text-left align-middle">
      <button
        type="button"
        onClick={() => handleSort(field)}
        className="inline-flex items-center gap-1 px-1 font-semibold text-gray-500 transition-colors hover:text-gray-700"
      >
        {label}
        <SortIcon active={sortField === field} direction={sortField === field ? sortDir : null} />
      </button>
    </th>
  );

  /** A non-sortable header. `decorative` shows the static sort glyph. */
  const renderPlainHeader = (label: string, decorative?: boolean) => (
    <th className="h-9 px-2 text-left align-middle">
      <span className="inline-flex items-center gap-1 px-1 font-semibold text-gray-500">
        {label}
        {decorative && <SortIcon />}
      </span>
    </th>
  );

  const tabItems: TabItem<(typeof TABS)[number]>[] = [
    {
      value: 'companyUsers',
      label: t('tabs.companyUsers'),
      icon: <UsersGroupIcon className="size-[18px]" />,
    },
    {
      value: 'approvalConfiguration',
      label: t('tabs.approvalConfiguration'),
      icon: <SettingsIcon className="size-[18px]" />,
    },
    {
      value: 'rolePermissions',
      label: t('tabs.rolePermissions'),
      icon: <ShieldIcon className="size-[18px]" />,
    },
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
          <Button onClick={openCreateModal} leftIcon={<NewUserIcon className="size-4" />}>
            {t('inviteUser')}
          </Button>
        </div>

        <Tabs items={tabItems} value={activeTab} onValueChange={setActiveTab} />
      </div>

      {/* ── Company users tab ── */}
      {activeTab === 'companyUsers' && (
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
              <DateRangeFilterDropdown
                label={t('filters.date')}
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

          {isLoading ? (
            <div className="flex h-48 items-center justify-center">
              <Spinner size="md" />
            </div>
          ) : isError ? (
            <div className="flex h-48 items-center justify-center text-sm text-destructive">
              {t('failedToLoad')}
            </div>
          ) : !data?.items.length ? (
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
                  description={t('createFirstUser')}
                />
              )}
            </div>
          ) : (
            <>
              <div className="overflow-hidden rounded-[10px] border border-gray-100 bg-white shadow-[0_1px_6px_0_rgba(10,13,18,0.06),0_1px_2px_0_rgba(10,13,18,0.02)]">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] table-fixed border-collapse text-sm">
                    <colgroup>
                      <col className="w-[180px]" />
                      <col />
                      <col className="w-[150px]" />
                      <col className="w-[180px]" />
                      <col className="w-[140px]" />
                      <col className="w-[200px]" />
                      <col className="w-[120px]" />
                    </colgroup>
                    <thead>
                      <tr className="border-b border-gray-100 bg-[#F9F9FA]">
                        {renderSortHeader('name', t('columns.fullName'))}
                        {renderSortHeader('email', t('columns.email'))}
                        {renderPlainHeader(t('columns.phone'))}
                        {renderSortHeader('role', t('columns.role'))}
                        {renderSortHeader('status', t('columns.status'))}
                        {renderPlainHeader(t('columns.projects'), true)}
                        {renderPlainHeader(t('columns.actions'))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.items.map((user) => {
                        const projectNames = user.projects?.length
                          ? user.projects.map((p) => p.name).join(', ')
                          : null;
                        return (
                          <tr
                            key={user.id}
                            className="border-b border-gray-50 transition-colors last:border-0 hover:bg-gray-25"
                          >
                            <td className="h-[46px] px-2 align-middle">
                              <span className="block truncate px-1 font-medium text-gray-800">
                                {user.name}
                              </span>
                            </td>
                            <td className="px-2 align-middle">
                              <span className="block truncate px-1 font-medium text-gray-800">
                                {user.email}
                              </span>
                            </td>
                            <td className="px-2 align-middle">
                              <span className="block truncate px-1 font-medium text-gray-800">
                                {user.phone ?? '—'}
                              </span>
                            </td>
                            <td className="px-2 align-middle">
                              <RoleBadge
                                role={user.role}
                                label={t(`roles.${user.role}` as 'roles.COMPANY_ADMIN')}
                              />
                            </td>
                            <td className="px-2 align-middle">
                              <StatusBadge
                                status={user.status}
                                label={t(`statuses.${user.status}` as 'statuses.ACTIVE')}
                              />
                            </td>
                            <td className="px-2 align-middle">
                              <span className="block truncate px-1 font-medium text-gray-800">
                                {projectNames ?? '—'}
                              </span>
                            </td>
                            <td className="px-2 align-middle">
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    navigate(ROUTES.userDetail.replace(':id', user.id))
                                  }
                                  aria-label="View"
                                  className={ICON_BTN_28}
                                >
                                  <EyeIcon className="size-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEditModal(user.id);
                                  }}
                                  aria-label="Edit"
                                  className={ICON_BTN_28}
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
                        );
                      })}
                    </tbody>
                  </table>
                </div>
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
        <div className="rounded-[18px] border border-gray-100 bg-[#F9F9FA] p-12 text-center text-gray-500">
          {t('tabs.approvalConfigurationPlaceholder')}
        </div>
      )}
      {activeTab === 'rolePermissions' && (
        <div className="rounded-[18px] border border-gray-100 bg-[#F9F9FA] p-12 text-center text-gray-500">
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
