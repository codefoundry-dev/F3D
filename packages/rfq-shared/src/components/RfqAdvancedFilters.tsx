import type { RfqListItem } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { DatePicker, Input, SelectDropdown, onDigitsOnly } from '@forethread/ui-components';

import type { AdvancedFilters } from '../stores';

interface RfqAdvancedFiltersProps {
  advancedFilters: AdvancedFilters;
  setAdvancedFilters: (filters: Partial<AdvancedFilters>) => void;
  items: RfqListItem[];
  statusKeys: readonly string[];
}

export function RfqAdvancedFilters({
  advancedFilters: af,
  setAdvancedFilters,
  items,
  statusKeys,
}: RfqAdvancedFiltersProps) {
  const { t } = useTranslation(['rfqs', 'common']);

  // Value must be the project id (the API filters by `projectId`, validated as
  // a UUID); the name is only the label. Mirrors the createdBy mapping below.
  const projectOptions = Array.from(
    new Map(
      items.filter((r) => r.projectId && r.projectName).map((r) => [r.projectId, r.projectName]),
    ),
  ).map(([id, name]) => ({ value: id, label: name }));

  const statusOptions = statusKeys.map((key) => ({
    value: key,
    label: t(`status.${key}` as never),
  }));

  const locationOptions = Array.from(
    new Set(items.map((r) => r.deliveryLocation).filter(Boolean)),
  ).map((loc) => ({ value: loc as string, label: loc as string }));

  const createdByOptions = Array.from(
    new Map(
      items
        .filter((r) => r.createdBy && r.createdByUserId)
        .map((r) => [r.createdByUserId, r.createdBy]),
    ),
  ).map(([id, name]) => ({ value: id, label: name }));

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <FilterField label={t('advancedFilters.project')}>
          <SelectDropdown
            placeholder={t('advancedFilters.allProjects')}
            options={projectOptions}
            selected={af.projectId}
            onSelectedChange={(v: string[]) => setAdvancedFilters({ projectId: v })}
          />
        </FilterField>
        <FilterField label={t('advancedFilters.rfqStatus')}>
          <SelectDropdown
            placeholder={t('advancedFilters.allStatus')}
            options={statusOptions}
            selected={af.status}
            onSelectedChange={(v: string[]) => setAdvancedFilters({ status: v })}
          />
        </FilterField>
        <FilterField label={t('advancedFilters.deliveryLocation')}>
          <SelectDropdown
            placeholder={t('advancedFilters.allLocations')}
            options={locationOptions}
            selected={af.deliveryLocation}
            onSelectedChange={(v: string[]) => setAdvancedFilters({ deliveryLocation: v })}
          />
        </FilterField>
        <FilterField label={t('advancedFilters.createdBy')}>
          <SelectDropdown
            placeholder={t('advancedFilters.allUsers')}
            options={createdByOptions}
            selected={af.createdByUserId}
            onSelectedChange={(v: string[]) => setAdvancedFilters({ createdByUserId: v })}
          />
        </FilterField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <FilterField label={t('advancedFilters.issueDate')}>
          <div className="flex gap-2">
            <DatePicker
              placeholder="From"
              className="flex-1"
              value={af.createdDateFrom}
              maxDate={af.createdDateTo || new Date().toISOString().slice(0, 10)}
              onChange={(v: string) => setAdvancedFilters({ createdDateFrom: v })}
            />
            <DatePicker
              placeholder="To"
              className="flex-1"
              value={af.createdDateTo}
              minDate={af.createdDateFrom || undefined}
              maxDate={new Date().toISOString().slice(0, 10)}
              onChange={(v: string) => setAdvancedFilters({ createdDateTo: v })}
            />
          </div>
        </FilterField>
        <FilterField label={t('advancedFilters.responseDeadline')}>
          <div className="flex gap-2">
            <DatePicker
              placeholder="From"
              className="flex-1"
              value={af.deadlineFrom}
              onChange={(v: string) => setAdvancedFilters({ deadlineFrom: v })}
            />
            <DatePicker
              placeholder="To"
              className="flex-1"
              value={af.deadlineTo}
              onChange={(v: string) => setAdvancedFilters({ deadlineTo: v })}
            />
          </div>
        </FilterField>
        <FilterField label={t('advancedFilters.approvedQuotes')}>
          <Input
            placeholder={t('advancedFilters.enterNumber')}
            inputMode="numeric"
            pattern="[0-9]*"
            value={af.minApprovedQuotes}
            onChange={(e) => setAdvancedFilters({ minApprovedQuotes: e.target.value })}
            onKeyDown={onDigitsOnly}
            className="h-10 bg-transparent"
          />
        </FilterField>
        <FilterField label={t('advancedFilters.approvedVendors')}>
          <Input
            placeholder={t('advancedFilters.enterNumber')}
            inputMode="numeric"
            pattern="[0-9]*"
            value={af.minApprovedVendors}
            onChange={(e) => setAdvancedFilters({ minApprovedVendors: e.target.value })}
            onKeyDown={onDigitsOnly}
            className="h-10 bg-transparent"
          />
        </FilterField>
      </div>
    </>
  );
}

function FilterField({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
