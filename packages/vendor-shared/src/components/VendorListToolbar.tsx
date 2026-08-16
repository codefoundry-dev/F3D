import { useTranslation } from '@forethread/i18n';
import {
  Button,
  SearchInput,
  FilterDropdownButton,
  DateRangeFilterDropdown,
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
