import type { ProjectListParams } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  CustomDropdown,
  Checkbox,
  Button,
  Spinner,
  Alert,
  Badge,
  Pagination,
  EmptyState,
  SearchInput,
  SortIcon,
  buttonVariants,
  useDebounce,
} from '@forethread/ui-components';
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

import { PAGE_SIZE, PROJECT_STATUSES, STATUS_COLOR_MAP } from '../constants';
import { useProjectSort } from '../hooks/useProjectSort';
import { useProjects } from '../services/projects.service';

export default function ProjectListPage() {
  const { t } = useTranslation(['projects', 'common']);
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const [statusFilter, setStatusFilter] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const { sortBy, sortDir, setSortBy, setSortDir, handleSort: onSort } = useProjectSort();

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
    limit: PAGE_SIZE,
    search: debouncedSearch || undefined,
    status: statusFilter || (showArchived ? 'ARCHIVED' : undefined),
    sortBy,
    sortDir,
  };

  const { data, isLoading, isError } = useProjects(params);

  const statusOptions = PROJECT_STATUSES.filter((s) => showArchived || s !== 'ARCHIVED').map(
    (s) => ({ value: s, label: t(`statuses.${s}`) }),
  );

  const sortOptions = [
    { value: 'name', label: t('sortBy.name') },
    { value: 'createdAt', label: t('sortBy.createdAt') },
    { value: 'status', label: t('sortBy.status') },
    { value: 'startDate', label: t('sortBy.startDate') },
  ];

  return (
    <div className="px-8 pt-6 pb-8">
      <div className="flex flex-col rounded-lg border border-border bg-background pb-4">
        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-6 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('list.title')}</h1>
            {data && (
              <p className="text-sm text-muted-foreground mt-1">
                {t('list.totalProjects', { total: data.meta.total })}
              </p>
            )}
          </div>
          <Link to={ROUTES.projectsNew} className={buttonVariants()}>
            {t('create.title')}
          </Link>
        </div>

        <div className="px-8">
          <div className="border-b border-border" />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 px-8 pt-4 pb-4">
          <SearchInput
            placeholder={t('list.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
            iconClassName="text-foreground"
          />

          <div className="w-44">
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

          <div className="w-44">
            <CustomDropdown
              options={sortOptions}
              value={sortBy}
              onChange={(val) => {
                setSortBy(val);
                setPage(1);
              }}
            />
          </div>

          <Button
            variant="outline"
            size="md"
            onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
          >
            {sortDir === 'asc' ? '↑' : '↓'}
          </Button>

          <Checkbox
            checked={showArchived}
            onChange={(checked) => {
              setShowArchived(checked);
              if (!checked && statusFilter === 'ARCHIVED') setStatusFilter('');
              setPage(1);
            }}
            label={t('list.showArchived')}
          />
        </div>

        {/* Table */}
        <div className="px-8">
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
                debouncedSearch || statusFilter
                  ? t('list.adjustFilters')
                  : t('list.createFirstProject')
              }
            />
          )}

          {data && data.items.length > 0 && (
            <>
              <div className="rounded-lg border border-border overflow-x-auto">
                <table className="w-full min-w-[800px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left bg-[hsl(var(--table-header))] font-['Inter'] text-[hsl(var(--table-header-foreground))]">
                      <th
                        className="px-4 py-3 text-xs font-bold leading-4 tracking-[0.6px] cursor-pointer select-none"
                        onClick={() => handleSort('name')}
                      >
                        <span className="flex items-center justify-between w-full">
                          {t('columns.name')}
                          <SortIcon
                            active={sortBy === 'name'}
                            direction={sortBy === 'name' ? sortDir : null}
                          />
                        </span>
                      </th>
                      <th
                        className="px-4 py-3 text-xs font-bold leading-4 tracking-[0.6px] cursor-pointer select-none"
                        onClick={() => handleSort('status')}
                      >
                        <span className="flex items-center justify-between w-full">
                          {t('columns.status')}
                          <SortIcon
                            active={sortBy === 'status'}
                            direction={sortBy === 'status' ? sortDir : null}
                          />
                        </span>
                      </th>
                      <th className="px-4 py-3 text-xs font-bold leading-4 tracking-[0.6px]">
                        {t('columns.type')}
                      </th>
                      <th className="px-4 py-3 text-xs font-bold leading-4 tracking-[0.6px]">
                        {t('columns.deliveryLocation')}
                      </th>
                      <th className="px-4 py-3 text-xs font-bold leading-4 tracking-[0.6px]">
                        {t('columns.members')}
                      </th>
                      <th
                        className="px-4 py-3 text-xs font-bold leading-4 tracking-[0.6px] cursor-pointer select-none"
                        onClick={() => handleSort('startDate')}
                      >
                        <span className="flex items-center justify-between w-full">
                          {t('columns.startDate')}
                          <SortIcon
                            active={sortBy === 'startDate'}
                            direction={sortBy === 'startDate' ? sortDir : null}
                          />
                        </span>
                      </th>
                      <th
                        className="px-4 py-3 text-xs font-bold leading-4 tracking-[0.6px] cursor-pointer select-none"
                        onClick={() => handleSort('createdAt')}
                      >
                        <span className="flex items-center justify-between w-full">
                          {t('columns.created')}
                          <SortIcon
                            active={sortBy === 'createdAt'}
                            direction={sortBy === 'createdAt' ? sortDir : null}
                          />
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((project) => (
                      <tr
                        key={project.id}
                        className="border-b border-border last:border-b-0 hover:bg-accent/50 cursor-pointer transition-colors"
                        onClick={() => navigate(ROUTES.projectDetail.replace(':id', project.id))}
                      >
                        <td className="py-3 font-medium text-foreground">{project.name}</td>
                        <td className="py-3">
                          <StatusBadge status={project.status} t={t as (key: string) => string} />
                        </td>
                        <td className="py-3 text-muted-foreground">{project.type ?? '-'}</td>
                        <td className="py-3 text-muted-foreground truncate max-w-[200px]">
                          {project.defaultDeliveryLocation || '-'}
                        </td>
                        <td className="py-3 text-muted-foreground">{project.memberCount}</td>
                        <td className="py-3 text-muted-foreground">
                          {project.startDate
                            ? new Date(project.startDate).toLocaleDateString()
                            : '-'}
                        </td>
                        <td className="py-3 text-muted-foreground">
                          {new Date(project.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={data.meta.page}
                totalPages={data.meta.totalPages}
                onPageChange={setPage}
                pageLabel={t('common:pageLabel', {
                  page: data.meta.page,
                  totalPages: data.meta.totalPages,
                })}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status, t }: { status: string; t: (key: string) => string }) {
  return (
    <Badge className={STATUS_COLOR_MAP[status] ?? 'bg-muted text-muted-foreground'}>
      {t(`statuses.${status}`)}
    </Badge>
  );
}
