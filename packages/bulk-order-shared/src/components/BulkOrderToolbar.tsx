import { useTranslation } from '@forethread/i18n';
import {
  Button,
  FilterDropdownButton,
  SearchInput,
  type FilterDropdownOption,
} from '@forethread/ui-components';
import PlusIcon from '@forethread/ui-components/assets/icons/plus.svg?react';

export interface BulkOrderToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  projectFilter: string[];
  onProjectFilterChange: (values: string[]) => void;
  projectOptions: FilterDropdownOption[];
  counterpartyFilter: string[];
  onCounterpartyFilterChange: (values: string[]) => void;
  counterpartyOptions: FilterDropdownOption[];
  counterpartyLabel: string;
  counterpartyPopoverTitle: string;
  onCreateNew?: () => void;
}

export function BulkOrderToolbar({
  search,
  onSearchChange,
  projectFilter,
  onProjectFilterChange,
  projectOptions,
  counterpartyFilter,
  onCounterpartyFilterChange,
  counterpartyOptions,
  counterpartyLabel,
  counterpartyPopoverTitle,
  onCreateNew,
}: BulkOrderToolbarProps) {
  const { t } = useTranslation('bulkOrders');

  return (
    <div className="px-4 md:px-8 pt-2 pb-4">
      {/* Desktop: search+filters left, create right */}
      <div className="hidden md:flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="max-w-[500px] w-full">
            <SearchInput
              className="w-full"
              iconClassName="text-foreground"
              placeholder={t('list.searchPlaceholder')}
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
          <div className="w-44">
            <FilterDropdownButton
              label={t('list.allProjects')}
              popoverTitle={t('filters.projectTitle')}
              clearLabel={t('filters.clear')}
              options={projectOptions}
              selected={projectFilter}
              onChange={onProjectFilterChange}
              searchPlaceholder={t('list.searchPlaceholder')}
            />
          </div>
          <div className="w-44">
            <FilterDropdownButton
              label={counterpartyLabel}
              popoverTitle={counterpartyPopoverTitle}
              clearLabel={t('filters.clear')}
              options={counterpartyOptions}
              selected={counterpartyFilter}
              onChange={onCounterpartyFilterChange}
              searchPlaceholder={t('list.searchPlaceholder')}
            />
          </div>
        </div>
        {onCreateNew && (
          <Button variant="primary" size="md" onClick={onCreateNew}>
            <PlusIcon className="w-5 h-5" />
            {t('list.createNew')}
          </Button>
        )}
      </div>

      {/* Mobile: stacked rows */}
      <div className="flex flex-col gap-3 md:hidden">
        <SearchInput
          iconClassName="text-foreground"
          placeholder={t('list.searchPlaceholder')}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <FilterDropdownButton
              label={t('list.allProjects')}
              popoverTitle={t('filters.projectTitle')}
              clearLabel={t('filters.clear')}
              options={projectOptions}
              selected={projectFilter}
              onChange={onProjectFilterChange}
              searchPlaceholder={t('list.searchPlaceholder')}
            />
          </div>
          <div className="flex-1">
            <FilterDropdownButton
              label={counterpartyLabel}
              popoverTitle={counterpartyPopoverTitle}
              clearLabel={t('filters.clear')}
              options={counterpartyOptions}
              selected={counterpartyFilter}
              onChange={onCounterpartyFilterChange}
              searchPlaceholder={t('list.searchPlaceholder')}
            />
          </div>
        </div>
        {onCreateNew && (
          <Button variant="primary" size="md" className="w-full" onClick={onCreateNew}>
            <PlusIcon className="w-5 h-5" />
            {t('list.createNew')}
          </Button>
        )}
      </div>
    </div>
  );
}
