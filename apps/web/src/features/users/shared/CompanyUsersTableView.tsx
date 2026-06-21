import type { UserResponse } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  Spinner,
  TablePagination,
  EmptyState,
  EmptyBoxIllustration,
  SearchEmptyIllustration,
  DotActionsMenu,
  FilterPopover,
  SortIcon,
  SearchInput,
  type DotAction,
} from '@forethread/ui-components';
import EditIcon from '@forethread/ui-components/assets/icons/edit.svg?react';
import EyeIcon from '@forethread/ui-components/assets/icons/eye-opened.svg?react';

import { DateRangeFilterPopover } from '../super-admin/ui/DateRangeFilterPopover';

import { RoleBadge, StatusBadge } from './userBadges';

/** 28px gradient-white bordered icon button (row-level actions). */
const ICON_BTN_28 =
  'flex size-7 shrink-0 items-center justify-center rounded-[8px] border border-gray-100 bg-gradient-to-b from-[#F9F9FA] to-white text-gray-600 shadow-[0_1px_6px_0_rgba(10,13,18,0.06),0_1px_2px_0_rgba(10,13,18,0.02)] transition-colors hover:bg-none hover:bg-gray-50 hover:text-gray-900';

interface FilterOption {
  value: string;
  label: string;
}

export interface CompanyUsersTableViewProps {
  users: UserResponse[];
  total: number;
  isLoading: boolean;
  isError: boolean;
  hasActiveFilters: boolean;
  // search
  search: string;
  onSearchChange: (value: string) => void;
  // filters
  statusOptions: FilterOption[];
  selectedStatuses: string[];
  onStatusChange: (value: string[]) => void;
  roleOptions: FilterOption[];
  selectedRoles: string[];
  onRoleChange: (value: string[]) => void;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onClearDates: () => void;
  // sorting (field is a column key; the parent maps it to its own SortField)
  sortField: string | null;
  sortDir: 'asc' | 'desc' | null;
  onSort: (field: string) => void;
  // pagination
  page: number;
  pageSize: number;
  pageSizeOptions: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  // rows
  getRowActions: (user: UserResponse) => DotAction[];
  onView: (id: string) => void;
  onEdit: (id: string) => void;
}

const COLUMNS: { field: string; key: string }[] = [
  { field: 'name', key: 'columns.fullName' },
  { field: 'email', key: 'columns.email' },
  { field: 'phone', key: 'columns.phone' },
  { field: 'role', key: 'columns.role' },
  { field: 'status', key: 'columns.status' },
  { field: 'dateJoined', key: 'columns.dateJoined' },
];

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Presentational "Company users" panel (US 1.09): a filter toolbar (result
 * count + Status/Role/Date popovers + search) over a sortable user table, with
 * loading/error/empty states + pagination. Wired by role-specific containers
 * (super-admin vs company-admin) that supply the data and row actions.
 */
export function CompanyUsersTableView({
  users,
  total,
  isLoading,
  isError,
  hasActiveFilters,
  search,
  onSearchChange,
  statusOptions,
  selectedStatuses,
  onStatusChange,
  roleOptions,
  selectedRoles,
  onRoleChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onClearDates,
  sortField,
  sortDir,
  onSort,
  page,
  pageSize,
  pageSizeOptions,
  onPageChange,
  onPageSizeChange,
  getRowActions,
  onView,
  onEdit,
}: CompanyUsersTableViewProps) {
  const { t } = useTranslation(['users', 'common']);

  const countLabel = search
    ? t('searchingResultLabel', { total })
    : hasActiveFilters
      ? t('showingUsersLabel', { total })
      : t('totalUsersLabel', { total });

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-2">
        <p className="text-sm font-medium leading-[1.4] tracking-[0.3px] text-gray-700">
          {countLabel}
        </p>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <FilterPopover
            label={t('filters.status')}
            popoverTitle={t('filters.status')}
            clearLabel={t('filters.clear')}
            options={statusOptions}
            selected={selectedStatuses}
            onChange={onStatusChange}
          />
          <FilterPopover
            label={t('filters.role')}
            popoverTitle={t('filters.role')}
            clearLabel={t('filters.clear')}
            options={roleOptions}
            selected={selectedRoles}
            onChange={onRoleChange}
          />
          <DateRangeFilterPopover
            label={t('filters.date')}
            popoverTitle={t('filters.date')}
            clearLabel={t('filters.clear')}
            dateFrom={dateFrom}
            dateTo={dateTo}
            fromPlaceholder={t('filters.from')}
            toPlaceholder={t('filters.to')}
            onChangeFrom={onDateFromChange}
            onChangeTo={onDateToChange}
            onClear={onClearDates}
          />
          <SearchInput
            className="w-[220px]"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
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
        <div className="flex items-center justify-center rounded-[10px] border border-gray-100 bg-white py-8 shadow-[0_1px_6px_0_rgba(10,13,18,0.06),0_1px_2px_0_rgba(10,13,18,0.02)]">
          {hasActiveFilters ? (
            <EmptyState
              illustration={<SearchEmptyIllustration />}
              titleClassName="text-[24px]"
              title={t('noResultsTitle')}
              description={
                search
                  ? t('noResultsDescriptionQuery', { query: search })
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
        <div className="flex flex-col gap-3">
          <div className="overflow-hidden rounded-[10px] border border-gray-100 bg-white shadow-[0_1px_6px_0_rgba(10,13,18,0.06),0_1px_2px_0_rgba(10,13,18,0.02)]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] table-fixed border-collapse text-sm">
                <colgroup>
                  <col />
                  <col className="w-[200px]" />
                  <col className="w-[150px]" />
                  <col className="w-[170px]" />
                  <col className="w-[128px]" />
                  <col className="w-[130px]" />
                  <col className="w-[110px]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-gray-100 bg-[#F9F9FA]">
                    {COLUMNS.map((col) => (
                      <th key={col.field} className="h-9 px-2 text-left align-middle">
                        <button
                          type="button"
                          onClick={() => onSort(col.field)}
                          className="inline-flex items-center gap-1 px-1 font-semibold text-gray-500 transition-colors hover:text-gray-700"
                        >
                          {t(col.key as 'columns.fullName')}
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
                  {users.map((user) => (
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
                          {formatDate(user.createdAt)}
                        </span>
                      </td>
                      <td className="px-2 align-middle">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onView(user.id)}
                            aria-label="View"
                            className={ICON_BTN_28}
                          >
                            <EyeIcon className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEdit(user.id);
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
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {total > 10 && (
            <TablePagination
              page={page}
              totalItems={total}
              pageSize={pageSize}
              pageSizeOptions={pageSizeOptions}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
              rowsPerPageLabel={t('common:rowsPerPage')}
              showingLabel={({ from, to, total: tot }) =>
                t('common:showingItems', { from, to, total: tot })
              }
              backLabel={t('common:back')}
              nextLabel={t('common:next')}
            />
          )}
        </div>
      )}
    </div>
  );
}
