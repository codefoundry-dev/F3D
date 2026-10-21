import { useTranslation } from '@forethread/i18n';
import {
  Button,
  SearchInput,
  FilterDropdownButton,
  DateRangeFilterDropdown,
  FloatingActionButton,
  MobileListToolbar,
  useIsPhone,
} from '@forethread/ui-components';
import NewUserIcon from '@forethread/ui-components/assets/icons/new-user.svg?react';

interface FilterOption {
  value: string;
  label: string;
}

interface VendorListToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  companyOptions: FilterOption[];
  companyFilter: string[];
  onCompanyFilterChange: (values: string[]) => void;
  statusOptions: FilterOption[];
  statusFilter: string[];
  onStatusFilterChange: (values: string[]) => void;
  categoryOptions: FilterOption[];
  categoryFilter: string[];
  onCategoryFilterChange: (values: string[]) => void;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onDateClear: () => void;
  onInviteVendor: () => void;
  onCreateCompany: () => void;
}

export function VendorListToolbar({
  search,
  onSearchChange,
  companyOptions,
  companyFilter,
  onCompanyFilterChange,
  statusOptions,
  statusFilter,
  onStatusFilterChange,
  categoryOptions,
  categoryFilter,
  onCategoryFilterChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onDateClear,
  onInviteVendor,
  onCreateCompany,
}: VendorListToolbarProps) {
  const { t } = useTranslation(['vendors', 'common']);
  const isPhone = useIsPhone();

  const filters = (
    <>
      <FilterDropdownButton
        label={t('filters.company')}
        popoverTitle={t('filters.company')}
        options={companyOptions}
        selected={companyFilter}
        onChange={onCompanyFilterChange}
      />
      <FilterDropdownButton
        label={t('filters.status')}
        popoverTitle={t('filters.status')}
        options={statusOptions}
        selected={statusFilter}
        onChange={onStatusFilterChange}
        hideSearch
      />
      <FilterDropdownButton
        label={t('filters.category')}
        popoverTitle={t('filters.category')}
        options={categoryOptions}
        selected={categoryFilter}
        onChange={onCategoryFilterChange}
      />
      <DateRangeFilterDropdown
        label={t('filters.date')}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onChangeFrom={onDateFromChange}
        onChangeTo={onDateToChange}
        onClear={onDateClear}
        clearLabel={t('common:clear', 'Clear')}
      />
    </>
  );

  // Phones: search + Filters sheet + ⋯ (create company), Invite is the FAB (ADR-0019 B9).
  if (isPhone) {
    const activeFilterCount =
      (companyFilter.length > 0 ? 1 : 0) +
      (statusFilter.length > 0 ? 1 : 0) +
      (categoryFilter.length > 0 ? 1 : 0) +
      (dateFrom || dateTo ? 1 : 0);
    return (
      <div className="pb-4">
        <MobileListToolbar
          search={search}
          onSearchChange={onSearchChange}
          searchPlaceholder={t('searchPlaceholder')}
          filtersLabel={t('filters.label', { defaultValue: 'Filters' })}
          activeFilterCount={activeFilterCount}
          onClearFilters={() => {
            onCompanyFilterChange([]);
            onStatusFilterChange([]);
            onCategoryFilterChange([]);
            onDateClear();
          }}
          clearFiltersLabel={t('common:clearAll', 'Clear all')}
          filters={<div className="flex flex-wrap items-center gap-2">{filters}</div>}
          menuActions={[
            { key: 'createCompany', label: t('createVendorCompany'), onClick: onCreateCompany },
          ]}
        />
        <FloatingActionButton label={t('inviteVendor')} onClick={onInviteVendor} />
      </div>
    );
  }

  return (
    <div className="pb-4 space-y-4">
      {/* Row 1: Search + Filters + action buttons */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center flex-wrap gap-3">
          <SearchInput
            className="w-[271px]"
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />

          {filters}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Button onClick={onInviteVendor} className="gap-2">
            <NewUserIcon className="w-4 h-4" />
            {t('inviteVendor')}
          </Button>
          <Button variant="outline" className="gap-2" onClick={onCreateCompany}>
            {t('createVendorCompany')}
          </Button>
        </div>
      </div>
    </div>
  );
}
