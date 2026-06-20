import type { ProjectListItem, ProjectListParams } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { usePageTitleStore } from '@forethread/rfq-shared';
import {
  CustomDropdown,
  Button,
  Spinner,
  Alert,
  Badge,
  AvatarWithStatus,
  DotActionsMenu,
  TablePagination,
  EmptyState,
  SearchInput,
  SortIcon,
  cn,
  useDebounce,
} from '@forethread/ui-components';
import EyeIcon from '@forethread/ui-components/assets/icons/eye-opened.svg?react';
import PlusIcon from '@forethread/ui-components/assets/icons/plus.svg?react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

import { PROJECT_STATUSES, PROJECT_TYPES } from '../constants';
import { useProjectSort } from '../hooks/useProjectSort';
import { useProjects } from '../services/projects.service';

const PAGE_SIZE_OPTIONS = [25, 50, 100];

const DATE_FORMAT: Intl.DateTimeFormatOptions = { month: 'short', day: '2-digit', year: 'numeric' };

function formatDate(value: string | null): string {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-US', DATE_FORMAT);
}

/** Empty string / null → "-" for table cells. */
function dash(value: string | null | undefined): string {
  return value?.trim() ? value : '-';
}

/** Columns in Figma order. `sortField` null → header is not sortable. */
const COLUMNS: { key: string; sortField: string | null; truncate?: boolean }[] = [
  { key: 'projectId', sortField: 'code' },
  { key: 'projectName', sortField: 'name', truncate: true },
  { key: 'defaultLocation', sortField: null, truncate: true },
  { key: 'status', sortField: 'status' },
  { key: 'type', sortField: 'type' },
  { key: 'assignedUsers', sortField: null },
  { key: 'startDate', sortField: 'startDate' },
  { key: 'endDate', sortField: 'expectedEndDate' },
];

export default function ProjectListPage() {
  const { t } = useTranslation(['projects', 'common']);
  const navigate = useNavigate();

  const setPageTitle = usePageTitleStore((s) => s.setTitle);
  useEffect(() => {
    setPageTitle(t('list.title'));
    return () => setPageTitle(null);
  }, [setPageTitle, t]);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const { sortBy, sortDir, handleSort: onSort } = useProjectSort();

  // Reset page when debounced search changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const handleSort = (field: string) => {
    onSort(field);
    setPage(1);
  };

  const params: ProjectListParams = {
    page,
    limit: pageSize,
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
    type: typeFilter || undefined,
    sortBy,
    sortDir,
  };

  const { data, isLoading, isError } = useProjects(params);

  const statusOptions = PROJECT_STATUSES.filter((s) => s !== 'ARCHIVED').map((s) => ({
    value: s,
    label: t(`statuses.${s}`),
  }));

  const typeOptions = PROJECT_TYPES.map((pt) => ({ value: pt, label: t(`types.${pt}`) }));

  const totalCount = data?.meta.total ?? 0;

  const th =
    'px-4 py-3 text-left text-xs font-bold leading-4 tracking-[0.6px] whitespace-nowrap text-[hsl(var(--table-header-foreground))]';
  const td = 'px-4 py-3 text-sm text-foreground';

  return (
    <div className="px-4 sm:px-8 pt-4 sm:pt-6 pb-6 sm:pb-8">
      <div className="flex flex-col rounded-lg border border-border bg-background pb-4">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 px-4 sm:px-8 pt-6 pb-4 lg:flex-row lg:items-center">
          <div className="flex-1 min-w-0">
            <SearchInput
              placeholder={t('list.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full"
              iconClassName="text-foreground"
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="w-36">
              <CustomDropdown
                options={statusOptions}
                value={statusFilter}
                onChange={(val) => {
                  setStatusFilter(val);
                  setPage(1);
                }}
                placeholder={t('list.allStatuses')}
              />
            </div>

            <div className="w-36">
              <CustomDropdown
                options={typeOptions}
                value={typeFilter}
                onChange={(val) => {
                  setTypeFilter(val);
                  setPage(1);
                }}
                placeholder={t('list.allTypes')}
              />
            </div>

            <Button
              variant="primary"
              size="lg"
              leftIcon={<PlusIcon className="w-4 h-4" />}
              onClick={() => navigate(ROUTES.projectsNew)}
            >
              {t('list.createNew')}
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="px-4 sm:px-8">
          {isLoading && (
            <div className="flex justify-center py-12">
              <Spinner size="lg" />
            </div>
          )}

          {isError && <Alert variant="destructive">{t('list.failedToLoad')}</Alert>}

          {data?.items.length === 0 && (
            <EmptyState
              title={t('list.noProjectsFound')}
              description={
                debouncedSearch || statusFilter || typeFilter
                  ? t('list.adjustFilters')
                  : t('list.createFirstProject')
              }
            />
          )}

          {data && data.items.length > 0 && (
            <div className="rounded-lg border border-border overflow-x-auto">
              <table className="w-full min-w-[1000px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-[hsl(var(--table-header))]">
                    {COLUMNS.map((col) => (
                      <th
                        key={col.key}
                        className={cn(th, col.sortField && 'cursor-pointer select-none')}
                        onClick={
                          col.sortField ? () => handleSort(col.sortField as string) : undefined
                        }
                      >
                        <span className="flex items-center justify-between gap-2">
                          {t(`columns.${col.key}` as never)}
                          {col.sortField && (
                            <SortIcon
                              active={sortBy === col.sortField}
                              direction={sortBy === col.sortField ? sortDir : null}
                            />
                          )}
                        </span>
                      </th>
                    ))}
                    <th className={th}>{t('columns.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((project) => (
                    <ProjectRow
                      key={project.id}
                      project={project}
                      onOpen={() => navigate(ROUTES.projectDetail.replace(':id', project.id))}
                      onEdit={() => navigate(ROUTES.projectEdit.replace(':id', project.id))}
                      usersLabel={t('list.usersCount', { count: project.memberCount })}
                      statusLabel={t(`statuses.${project.status}` as never)}
                      viewLabel={t('actions.view')}
                      editLabel={t('actions.edit')}
                      tdClass={td}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {totalCount >= 25 && (
          <div className="px-4 sm:px-8">
            <TablePagination
              page={page}
              totalItems={totalCount}
              pageSize={pageSize}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              rowsPerPageLabel={t('list.rowsPerPage')}
              showingLabel={({ from, to, total }) => t('list.showing', { from, to, total })}
              backLabel={t('pagination.back')}
              nextLabel={t('pagination.next')}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function ProjectRow({
  project,
  onOpen,
  onEdit,
  usersLabel,
  statusLabel,
  viewLabel,
  editLabel,
  tdClass,
}: {
  project: ProjectListItem;
  onOpen: () => void;
  onEdit: () => void;
  usersLabel: string;
  statusLabel: string;
  viewLabel: string;
  editLabel: string;
  tdClass: string;
}) {
  return (
    <tr
      className="border-b border-border last:border-b-0 hover:bg-accent/50 cursor-pointer transition-colors"
      onClick={onOpen}
    >
      <td className={cn(tdClass, 'whitespace-nowrap')}>{project.code}</td>
      <td className={cn(tdClass, 'font-medium truncate max-w-[200px]')}>{project.name}</td>
      <td className={cn(tdClass, 'text-muted-foreground truncate max-w-[180px]')}>
        {dash(project.defaultDeliveryLocation)}
      </td>
      <td className={tdClass}>
        <Badge className="bg-muted text-muted-foreground">{statusLabel}</Badge>
      </td>
      <td className={cn(tdClass, 'text-muted-foreground whitespace-nowrap')}>
        {dash(project.type)}
      </td>
      <td className={cn(tdClass, 'whitespace-nowrap')}>
        <span className="flex items-center">
          <span className="flex items-center">
            {project.memberAvatars.slice(0, 4).map((m, i) => (
              <span
                key={m.id}
                className={cn('rounded-full ring-2 ring-background', i > 0 && '-ml-2')}
              >
                <AvatarWithStatus name={m.name} avatarUrl={m.avatarUrl} size={24} />
              </span>
            ))}
          </span>
          <span className="ml-2 text-muted-foreground">{usersLabel}</span>
        </span>
      </td>
      <td className={cn(tdClass, 'text-muted-foreground whitespace-nowrap')}>
        {formatDate(project.startDate)}
      </td>
      <td className={cn(tdClass, 'text-muted-foreground whitespace-nowrap')}>
        {formatDate(project.expectedEndDate)}
      </td>
      <td className={tdClass} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title={viewLabel}
            aria-label={viewLabel}
            onClick={onOpen}
          >
            <EyeIcon className="w-4 h-4" />
          </button>
          <DotActionsMenu
            bordered={false}
            actions={[
              { key: 'view', label: viewLabel, onClick: onOpen },
              { key: 'edit', label: editLabel, onClick: onEdit },
            ]}
          />
        </div>
      </td>
    </tr>
  );
}
