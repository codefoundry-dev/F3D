import type { UserResponse } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { usePageTitleStore } from '@forethread/rfq-shared';
import { UserStatus } from '@forethread/shared-types/client';
import {
  cn,
  Badge,
  Button,
  Spinner,
  TablePagination,
  EmptyState,
  DotActionsMenu,
  StatusActionModal,
  SortIcon,
  SearchInput,
  FilterDropdownButton,
  DateRangeFilterDropdown,
  notificationService,
  NEUTRAL_STATUS_COLOR,
  type DotAction,
} from '@forethread/ui-components';
import CrossInCircleIcon from '@forethread/ui-components/assets/icons/cross-in-circle.svg?react';
import EyeIcon from '@forethread/ui-components/assets/icons/eye-opened.svg?react';
import NewUserIcon from '@forethread/ui-components/assets/icons/new-user.svg?react';
import { VendorInviteSuccessModal } from '@forethread/vendor-shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

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

  // Surface the page title in the global app header (per Figma every screen
  // shows its title there). Back-arrow returns to Settings. (US 3.10)
  useEffect(() => {
    setPageTitle(t('title'), null, ROUTES.settings);
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

  const sortableColumns: { field: SortField; label: string; className?: string }[] = [
    { field: 'name', label: t('columns.fullName'), className: 'px-6' },
    { field: 'email', label: t('columns.email'), className: 'w-[30%]' },
  ];

  const hasUsers = data?.items && data.items.length > 0;

  return (
    <div className="p-8">
      <div className="bg-card rounded-lg border border-border p-6">
        {/* Toolbar */}
        <div className="flex items-center justify-between flex-wrap gap-3 pb-4">
          <div className="flex items-center flex-wrap gap-3">
            <SearchInput
              className="w-[271px]"
              inputClassName="h-11"
              placeholder={t('searchPlaceholder')}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            <FilterDropdownButton
              label={t('filters.status')}
              popoverTitle={t('filters.status')}
              options={STATUS_FILTER_OPTIONS}
              selected={statusFilter}
              onChange={(selected) => {
                setStatusFilter(selected);
                setPage(1);
              }}
              buttonClassName="h-11"
              hideSearch
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
              buttonClassName="h-11"
            />
          </div>
          <Button onClick={openInviteModal} className="gap-2">
            <NewUserIcon className="w-4 h-4" />
            {t('inviteUser')}
          </Button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Spinner size="md" />
          </div>
        ) : isError ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
            {t('failedToLoad')}
          </div>
        ) : !hasUsers ? (
          <div className="py-12">
            <EmptyState title={t('noUsersFound')} description={t('createFirstUser')} />
          </div>
        ) : (
          <>
            <div className="border border-border rounded-lg overflow-x-auto">
              <table className="w-full text-sm table-fixed min-w-[800px]">
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
                      {t('columns.phone')}
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-bold leading-4 tracking-[0.6px] cursor-pointer select-none transition-colors"
                      onClick={() => handleSort('status')}
                    >
                      <span className="flex items-center justify-between w-full">
                        {t('columns.status')}
                        <SortIcon
                          active={sortField === 'status'}
                          direction={sortField === 'status' ? sortDir : null}
                        />
                      </span>
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-bold leading-4 tracking-[0.6px] cursor-pointer select-none transition-colors"
                      onClick={() => handleSort('createdAt')}
                    >
                      <span className="flex items-center justify-between w-full">
                        {t('columns.dateJoined')}
                        <SortIcon
                          active={sortField === 'createdAt'}
                          direction={sortField === 'createdAt' ? sortDir : null}
                        />
                      </span>
                    </th>
                    <th className="w-[100px] px-4 py-3 text-right text-xs font-bold leading-4 tracking-[0.6px]">
                      {t('columns.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.items.map((user) => {
                    const rowActions = getRowActions(user);
                    return (
                      <tr key={user.id} className="hover:bg-accent/50 transition-colors">
                        <td className="px-6 py-4 text-foreground">{user.name}</td>
                        <td
                          className="px-4 py-4 text-muted-foreground truncate max-w-0"
                          title={user.email}
                        >
                          {user.email}
                        </td>
                        <td className="px-4 py-4 text-muted-foreground">{user.phone ?? '—'}</td>
                        <td className="px-4 py-4">
                          <Badge className={NEUTRAL_STATUS_COLOR}>
                            {t(`statuses.${user.status}` as 'statuses.ACTIVE')}
                          </Badge>
                        </td>
                        <td className="px-4 py-4 text-muted-foreground">
                          {formatDate(user.createdAt)}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                              aria-label="View"
                              onClick={() => navigate(`/users/${user.id}`)}
                            >
                              <EyeIcon className="w-4 h-4" />
                            </button>
                            {rowActions.length > 0 && (
                              <DotActionsMenu actions={rowActions} bordered={false} />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {data && (
              <div className="pt-4">
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
              <CrossInCircleIcon className="w-6 h-6 text-foreground" />
            ) : undefined
          }
        />
      )}
    </div>
  );
}
