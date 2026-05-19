import { cn } from '../../utils/cn';
import { FilterChip } from '../FilterChip';

export interface QuickFilterOption {
  label: string;
  value: string;
}

export interface DataTableQuickFiltersProps {
  filters: QuickFilterOption[];
  activeFilter?: string;
  onFilterChange: (value: string) => void;
  className?: string;
}

export function DataTableQuickFilters({
  filters,
  activeFilter,
  onFilterChange,
  className,
}: DataTableQuickFiltersProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {filters.map((filter) => (
        <FilterChip
          key={filter.value}
          label={filter.label}
          active={activeFilter === filter.value}
          onClick={() => onFilterChange(filter.value)}
        />
      ))}
    </div>
  );
}
