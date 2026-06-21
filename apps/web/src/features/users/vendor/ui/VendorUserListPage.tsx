import type { UserResponse } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { usePageTitleStore } from '@forethread/rfq-shared';
import { UserStatus } from '@forethread/shared-types/client';
import {
  Button,
  Spinner,
  TablePagination,
  EmptyState,
  EmptyBoxIllustration,
  DotActionsMenu,
  StatusActionModal,
  SortIcon,
  SearchInput,
  FilterPopover,
  DateRangeFilterDropdown,
  notificationService,
  type DotAction,
} from '@forethread/ui-components';
import CrossInCircleIcon from '@forethread/ui-components/assets/icons/cross-in-circle.svg?react';
import EyeIcon from '@forethread/ui-components/assets/icons/eye-opened.svg?react';
import NewUserIcon from '@forethread/ui-components/assets/icons/new-user.svg?react';
import UsersGroupIcon from '@forethread/ui-components/assets/icons/users-group.svg?react';
import { VendorInviteSuccessModal } from '@forethread/vendor-shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { StatusBadge } from '@/features/users/shared/userBadges';

import { useVendorUserSort, type SortField } from '../hooks/useVendorUserSort';
import {
  useVendorUsers,
  useResendVendorUserInvitation,
  useCancelVendorUserInvitation,
} from '../services/vendor-users.service';
import { useVendorUsersStore } from '../state/vendor-users.store';

import { InviteVendorUserModal } from './InviteVendorUserModal';

const PAGE_SIZE_OPTIONS = [10, 25, 50];

const STATUS_FILTER_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INVITED', label: 'Invited' },
  { value: 'INACTIVE', label: 'Deactivated' },
];

/** 28px gradient-white bordered icon button (row-level actions). */
const ICON_BTN_28 =
  'flex size-7 shrink-0 items-center justify-center rounded-[8px] border border-gray-100 bg-gradient-to-b from-[#F9F9FA] to-white text-gray-600 shadow-[0_1px_6px_0_rgba(10,13,18,0.06),0_1px_2px_0_rgba(10,13,18,0.02)] transition-colors hover:bg-none hover:bg-gray-50 hover:text-gray-900';

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function VendorUserListPage() {
  const { t } = useTranslation(['vendorUsers', 'common']);
  const navigate = useNavigate();
  const setPageTitle = usePageTitleStore((s) => s.setTitle);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const { sortField, sortDir, handleSort: onSort } = useVendorUserSort();

  const {
    isInviteModalOpen,
    openInviteModal,
    closeInviteModal,
    isSuccessModalOpen,
    invitedUserEmail,
    closeSuccessModal,
    isStatusActionModalOpen,
    statusActionType,
    statusActionUserId,
    statusActionUserEmail,
    openStatusActionModal,
    closeStatusActionModal,
  } = useVendorUsersStore();

  const resendMutation = useResendVendorUserInvitation();
  const cancelInvitationMutation = useCancelVendorUserInvitation();

  // App-bar breadcrumb / page title (breadcrumbs app-wide; no back-arrow). (US 3.10)
  useEffect(() => {
    setPageTitle(t('title'), null, null, [{ label: t('title') }]);
    return () => setPageTitle(null);
  }, [setPageTitle, t]);

  const { data, isLoading, isError } = useVendorUsers({
    page,
    limit: pageSize,
    search: search || undefined,
    status: statusFilter.length ? statusFilter.join(',') : undefined,
    sortBy: sortField ?? undefined,
    sortDir: sortDir ?? undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const successLabels = useMemo(
    () => ({
      backButton: t('invitationSuccess.backToUsers'),
      redirecting: (seconds: number) => t('invitationSuccess.redirecting', { seconds }),
    }),
    [t],
  );

  const handleSort = useCallback(
    (field: SortField) => {
      onSort(field);
      setPage(1);
    },
    [onSort],
  );

  const handleStatusAction = () => {
    if (!statusActionUserId || !statusActionType || !statusActionUserEmail) return;
    if (statusActionType === 'resendInvitation') {
      resendMutation.mutate(statusActionUserId, {
        onSuccess: () => {
          closeStatusActionModal();
          notificationService.success(t('resendInvitationSuccess'));
        },
      });
      return;
    }
    if (statusActionType === 'cancelInvitation') {
      cancelInvitationMutation.mutate(statusActionUserId, {
        onSuccess: () => {
          closeStatusActionModal();
          notificationService.success(t('cancelInvitationSuccess'));
        },
      });
    }
  };

  // Vendors can only manage invitations (resend / cancel) on pending invites —
  // they cannot edit or deactivate users. Mirrors VendorUserDetailPage. (US 3.10)
  const getRowActions = (user: UserResponse): DotAction[] => {
    if (user.status !== UserStatus.INVITED) return [];
    return [
      {
        key: 'resendInvitation',
        label: t('actions.resendInvitation'),
        onClick: () => openStatusActionModal('resendInvitation', user.id, user.email),
      },
      {
        key: 'cancelInvitation',
        label: t('actions.cancelInvitation'),
        onClick: () => openStatusActionModal('cancelInvitation', user.id, user.email),
      },
    ];
  };

  // Vendors all share the VENDOR role, so there is no Role column here. (US 3.10)
  const columns: { field: SortField; label: string }[] = [
    { field: 'name', label: t('columns.fullName') },
    { field: 'email', label: t('columns.email') },
    { field: 'phone', label: t('columns.phone') },
    { field: 'status', label: t('columns.status') },
    { field: 'createdAt', label: t('columns.dateJoined') },
  ];

  const total = data?.meta.total ?? 0;
  const hasUsers = data?.items && data.items.length > 0;

  return (
    <div className="flex flex-1 flex-col gap-3 px-6 py-4">
      {/* ── Page header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-[8px] border border-gray-100 bg-gradient-to-b from-[#F9F9FA] to-white p-px text-gray-700 shadow-[0_1px_3px_0_rgba(10,13,18,0.06),0_1px_1px_0_rgba(10,13,18,0.02)]">
            <UsersGroupIcon className="size-[15px]" />
          </span>
          <h1 className="text-[20px] font-medium leading-[1.4] tracking-[0.3px] text-gray-900">
            {t('title')}
          </h1>
        </div>
        <Button onClick={openInviteModal} leftIcon={<NewUserIcon className="size-4" />}>
          {t('inviteUser')}
        </Button>
      </div>

      {/* ── DS container (toolbar + table) ── */}
      <div className="flex flex-1 flex-col gap-4 rounded-[18px] border border-gray-100 bg-[#F9F9FA] p-3 shadow-[0_1px_6px_0_rgba(10,13,18,0.06),0_1px_2px_0_rgba(10,13,18,0.02)]">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex-1" />
          <div className="flex flex-wrap items-center justify-end gap-2">
            <FilterPopover
              label={t('filters.status')}
              popoverTitle={t('filters.status')}
              clearLabel={t('common:clear', 'Clear')}
              options={STATUS_FILTER_OPTIONS}
              selected={statusFilter}
              onChange={(selected) => {
                setStatusFilter(selected);
                setPage(1);
              }}
            />
            <DateRangeFilterDropdown
              label={t('filters.date')}
              dateFrom={dateFrom}
              dateTo={dateTo}
              onChangeFrom={(v) => {
                setDateFrom(v);
                setPage(1);
              }}
              onChangeTo={(v) => {
                setDateTo(v);
                setPage(1);
              }}
              onClear={() => {
                setDateFrom('');
                setDateTo('');
                setPage(1);
              }}
              clearLabel={t('common:clear', 'Clear')}
            />
            <SearchInput
              className="w-[220px]"
              placeholder={t('searchPlaceholder')}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
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
        ) : !hasUsers ? (
          <div className="flex flex-1 items-center justify-center rounded-[10px] border border-gray-100 bg-white shadow-[0_1px_6px_0_rgba(10,13,18,0.06),0_1px_2px_0_rgba(10,13,18,0.02)]">
            <EmptyState
              illustration={<EmptyBoxIllustration />}
              title={t('noUsersFound')}
              description={t('createFirstUser')}
            />
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-1.5">
            <div className="overflow-hidden rounded-[10px] border border-gray-100 bg-white shadow-[0_1px_6px_0_rgba(10,13,18,0.06),0_1px_2px_0_rgba(10,13,18,0.02)]">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] table-fixed border-collapse text-sm">
                  <colgroup>
                    <col />
                    <col className="w-[220px]" />
                    <col className="w-[150px]" />
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
                            onClick={() => handleSort(col.field)}
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
                        <span className="px-1 font-semibold text-gray-500">
                          {t('columns.actions')}
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((user) => {
                      const rowActions = getRowActions(user);
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
                            <span
                              className="block truncate px-1 font-medium text-gray-800"
                              title={user.email}
                            >
                              {user.email}
                            </span>
                          </td>
                          <td className="px-2 align-middle">
                            <span className="block truncate px-1 font-medium text-gray-800">
                              {user.phone ?? '—'}
                            </span>
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
                              <button
                                type="button"
                                className={ICON_BTN_28}
                                aria-label="View"
                                onClick={() => navigate(`/users/${user.id}`)}
                              >
                                <EyeIcon className="size-3.5" />
                              </button>
                              {rowActions.length > 0 && (
                                <DotActionsMenu
                                  actions={rowActions}
                                  bordered={false}
                                  triggerClassName={ICON_BTN_28}
                                />
                              )}
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
              <div className="pt-1">
                <TablePagination
                  page={data.meta.page}
                  totalItems={total}
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

      {/* Modals */}
      {isInviteModalOpen && <InviteVendorUserModal onClose={closeInviteModal} />}
      {isSuccessModalOpen && invitedUserEmail && (
        <VendorInviteSuccessModal
          email={invitedUserEmail}
          onClose={closeSuccessModal}
          labels={successLabels}
        />
      )}
      {isStatusActionModalOpen && statusActionType && (
        <StatusActionModal
          onClose={closeStatusActionModal}
          onConfirm={handleStatusAction}
          isLoading={
            statusActionType === 'cancelInvitation'
              ? cancelInvitationMutation.isPending
              : resendMutation.isPending
          }
          title={t(`${statusActionType}Modal.title` as 'cancelInvitationModal.title')}
          subtitle={t(`${statusActionType}Modal.subtitle` as 'cancelInvitationModal.subtitle')}
          infoText={
            <span
              dangerouslySetInnerHTML={{
                __html: t(`${statusActionType}Modal.info` as 'cancelInvitationModal.info', {
                  email: statusActionUserEmail ?? '',
                  interpolation: { escapeValue: false },
                }),
              }}
            />
          }
          confirmLabel={t(`${statusActionType}Modal.confirm` as 'cancelInvitationModal.confirm')}
          cancelLabel={t('common:cancel')}
          variant={statusActionType === 'cancelInvitation' ? 'danger' : 'default'}
          icon={
            statusActionType === 'cancelInvitation' ? (
              <CrossInCircleIcon className="h-6 w-6 text-foreground" />
            ) : undefined
          }
        />
      )}
    </div>
  );
}
