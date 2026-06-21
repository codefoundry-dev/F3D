import { useTranslation } from '@forethread/i18n';
import { usePageTitleStore } from '@forethread/rfq-shared';
import { TablePagination, type FilterDropdownOption } from '@forethread/ui-components';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { BULK_ORDER_ROUTES } from '../constants/routes';
import { PAGE_SIZE_OPTIONS } from '../constants';
import {
  useProjectFilterOptions,
  useVendorFilterOptions,
  useContractorFilterOptions,
} from '../hooks/useFilterOptions';
import { useBulkOrderListState } from '../hooks/useBulkOrderListState';

import { AllChangeHistorySection } from './AllChangeHistorySection';
import { BulkOrderTable } from './BulkOrderTable';
import { BulkOrderToolbar } from './BulkOrderToolbar';

export type CounterpartyType = 'vendor' | 'contractor';

export interface BulkOrderListPageProps {
  /** Label for the counterparty filter trigger, e.g. "All vendors" or "All Contractors" */
  counterpartyFilterLabel?: string;
  /** Title inside the counterparty filter popover, e.g. "Vendors" or "Contractors" */
  counterpartyPopoverTitle?: string;
  /** Override the i18n key for the counterparty table column header */
  counterpartyColumnKey?: string;
  /** Which type of counterparty to load for the filter: 'vendor' (default) or 'contractor' */
  counterpartyType?: CounterpartyType;
  /** Override project filter options (if not provided, fetched automatically) */
  projectOptions?: FilterDropdownOption[];
  /** Override counterparty filter options (if not provided, fetched automatically) */
  counterpartyOptions?: FilterDropdownOption[];
  /** Hide the create button (e.g. for vendor view) */
  hideCreate?: boolean;
  /** True when rendered inside the vendor app */
  isVendorView?: boolean;
}

export function BulkOrderListPage({
  counterpartyFilterLabel,
  counterpartyPopoverTitle,
  counterpartyColumnKey,
  counterpartyType = 'vendor',
  projectOptions: projectOptionsProp,
  counterpartyOptions: counterpartyOptionsProp,
  hideCreate = false,
  isVendorView = false,
}: BulkOrderListPageProps) {
  const { t } = useTranslation('bulkOrders');
  const navigate = useNavigate();

  // App-bar breadcrumb / page title (top-level list page → single leaf crumb).
  const setTitle = usePageTitleStore((s) => s.setTitle);
  useEffect(() => {
    setTitle(t('list.title') as string, t('list.subtitle') as string, null, [
      { label: t('list.title') as string },
    ]);
    return () => setTitle(null);
  }, [setTitle, t]);

  // Fetch filter options automatically if not provided
  const fetchedProjectOptions = useProjectFilterOptions();
  const fetchedVendorOptions = useVendorFilterOptions();
  const fetchedContractorOptions = useContractorFilterOptions();

  const projectOptions = projectOptionsProp ?? fetchedProjectOptions;
  const counterpartyOptions =
    counterpartyOptionsProp ??
    (counterpartyType === 'contractor' ? fetchedContractorOptions : fetchedVendorOptions);

  const {
    page,
    setPage,
    pageSize,
    setPageSize,
    search,
    setSearch,
    sortBy,
    sortDir,
    handleSort,
    projectFilter,
    handleProjectFilterChange,
    counterpartyFilter,
    handleCounterpartyFilterChange,
    items,
    totalCount,
    isLoading,
  } = useBulkOrderListState(counterpartyType);

  const navigateToDetail = (id: string) =>
    navigate(BULK_ORDER_ROUTES.bulkOrderDetail.replace(':id', id));

  const handleDrawdown = (id: string) => {
    navigate(BULK_ORDER_ROUTES.bulkOrderDrawdown.replace(':id', id));
  };

  const handleChange = (id: string) => {
    navigate(BULK_ORDER_ROUTES.bulkOrderChange.replace(':id', id));
  };

  return (
    <div className="px-4 md:px-8 pt-6 pb-8 overflow-x-hidden">
      <div className="flex flex-col rounded-lg border border-border bg-background pb-4">
        <div className="mt-4 px-4 md:px-8">
          <div className="border-b border-border" />
        </div>

        <BulkOrderToolbar
          search={search}
          onSearchChange={setSearch}
          projectFilter={projectFilter}
          onProjectFilterChange={handleProjectFilterChange}
          projectOptions={projectOptions}
          counterpartyFilter={counterpartyFilter}
          onCounterpartyFilterChange={handleCounterpartyFilterChange}
          counterpartyOptions={counterpartyOptions}
          counterpartyLabel={counterpartyFilterLabel ?? t('list.allVendors')}
          counterpartyPopoverTitle={counterpartyPopoverTitle ?? t('filters.vendorsTitle')}
          onCreateNew={hideCreate ? undefined : () => navigate(BULK_ORDER_ROUTES.bulkOrderNew)}
        />

        <div className="px-4 md:px-8">
          <BulkOrderTable
            items={items}
            isLoading={isLoading}
            sortBy={sortBy}
            sortDir={sortDir}
            onSort={handleSort}
            onRowClick={navigateToDetail}
            onView={navigateToDetail}
            onDrawdown={handleDrawdown}
            onChange={handleChange}
            counterpartyColumnKey={counterpartyColumnKey}
          />
        </div>

        {totalCount > pageSize && (
          <div className="px-4 md:px-8">
            <TablePagination
              page={page}
              totalItems={totalCount}
              pageSize={pageSize}
              pageSizeOptions={[...PAGE_SIZE_OPTIONS]}
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

      {items.length > 0 && (
        <div className="mt-6">
          <AllChangeHistorySection bulkOrders={items} isVendorView={isVendorView} />
        </div>
      )}
    </div>
  );
}
