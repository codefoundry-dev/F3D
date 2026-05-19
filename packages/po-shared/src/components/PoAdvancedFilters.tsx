import type { PoListItem } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { Checkbox, DatePicker, Input, SelectDropdown } from '@forethread/ui-components';

import type { PoAdvancedFilters as PoAdvancedFiltersType } from '../stores';

interface PoAdvancedFiltersProps {
  advancedFilters: PoAdvancedFiltersType;
  setAdvancedFilters: (filters: Partial<PoAdvancedFiltersType>) => void;
  items: PoListItem[];
  statusKeys: readonly string[];
  typeKeys: readonly string[];
}

const OPERATIONAL_STATE_KEYS = [
  'isBulkDrawdown',
  'isHoldForRelease',
  'needApproval',
  'hasMessages',
  'hasAttachments',
] as const;

export function PoAdvancedFilters({
  advancedFilters: af,
  setAdvancedFilters,
  items,
  statusKeys,
  typeKeys,
}: PoAdvancedFiltersProps) {
  const { t } = useTranslation(['purchaseOrders', 'common']);

  const projectOptions = Array.from(new Set(items.map((r) => r.projectName).filter(Boolean))).map(
    (name) => ({ value: name, label: name }),
  );

  const vendorOptions = Array.from(new Set(items.map((r) => r.contractorName).filter(Boolean))).map(
    (name) => ({ value: name as string, label: name as string }),
  );

  const statusOptions = statusKeys.map((key) => ({
    value: key,
    label: t(`status.${key}` as never),
  }));

  const typeOptions = typeKeys.map((key) => ({
    value: key,
    label: t(`poTypes.${key}` as never),
  }));

  const createdByOptions = Array.from(new Set(items.map((r) => r.createdBy).filter(Boolean))).map(
    (name) => ({ value: name, label: name }),
  );

  const lastModifiedByOptions = Array.from(
    new Set(items.map((r) => r.lastModifiedBy).filter(Boolean)),
  ).map((name) => ({ value: name as string, label: name as string }));

  const onDigitsOnly = (e: React.KeyboardEvent) => {
    if (
      !/[\d.]/.test(e.key) &&
      !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End'].includes(e.key)
    ) {
      e.preventDefault();
    }
  };

  const allChecked = OPERATIONAL_STATE_KEYS.every((k) => af[k]);
  const noneChecked = OPERATIONAL_STATE_KEYS.every((k) => !af[k]);

  const handleSelectAll = () => {
    const patch: Partial<PoAdvancedFiltersType> = {};
    for (const k of OPERATIONAL_STATE_KEYS) patch[k] = true;
    setAdvancedFilters(patch);
  };

  const handleDeselectAll = () => {
    const patch: Partial<PoAdvancedFiltersType> = {};
    for (const k of OPERATIONAL_STATE_KEYS) patch[k] = false;
    setAdvancedFilters(patch);
  };

  return (
    <>
      {/* ── Core section label ── */}
      <p className="text-xs font-medium text-muted-foreground mb-3">{t('advancedFilters.core')}</p>

      {/* Single 4-column grid so all rows share the same column tracks */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-4 mb-6">
        {/* Row 1: Project, Vendor, PO status, PO type */}
        <FilterField label={t('advancedFilters.project')}>
          <SelectDropdown
            placeholder={t('advancedFilters.allProjects')}
            options={projectOptions}
            selected={af.projectId}
            onSelectedChange={(v: string[]) => setAdvancedFilters({ projectId: v })}
          />
        </FilterField>
        <FilterField label={t('advancedFilters.vendor')}>
          <SelectDropdown
            placeholder={t('advancedFilters.allVendors')}
            options={vendorOptions}
            selected={af.vendorId}
            onSelectedChange={(v: string[]) => setAdvancedFilters({ vendorId: v })}
          />
        </FilterField>
        <FilterField label={t('advancedFilters.poStatus')}>
          <SelectDropdown
            placeholder={t('advancedFilters.allStatuses')}
            options={statusOptions}
            selected={af.status}
            onSelectedChange={(v: string[]) => setAdvancedFilters({ status: v })}
          />
        </FilterField>
        <FilterField label={t('advancedFilters.poType')}>
          <SelectDropdown
            placeholder={t('advancedFilters.allTypes')}
            options={typeOptions}
            selected={af.poType}
            onSelectedChange={(v: string[]) => setAdvancedFilters({ poType: v })}
          />
        </FilterField>

        {/* Row 2: Total amount (under Project+Vendor), Issue date (under PO status), Planned delivery (under PO type) */}
        <FilterField label={t('advancedFilters.totalAmount')} className="sm:col-span-2">
          <div className="flex gap-2">
            <Input
              placeholder="From"
              inputMode="decimal"
              value={af.totalAmountFrom}
              onChange={(e) => setAdvancedFilters({ totalAmountFrom: e.target.value })}
              onKeyDown={onDigitsOnly}
              className="h-10 bg-transparent flex-1"
            />
            <Input
              placeholder="To"
              inputMode="decimal"
              value={af.totalAmountTo}
              onChange={(e) => setAdvancedFilters({ totalAmountTo: e.target.value })}
              onKeyDown={onDigitsOnly}
              className="h-10 bg-transparent flex-1"
            />
          </div>
        </FilterField>
        <FilterField label={t('advancedFilters.issueDate')}>
          <div className="flex gap-2">
            <DatePicker
              placeholder="From"
              className="flex-1"
              value={af.issueDateFrom}
              maxDate={af.issueDateTo || new Date().toISOString().slice(0, 10)}
              onChange={(v: string) => setAdvancedFilters({ issueDateFrom: v })}
            />
            <DatePicker
              placeholder="To"
              className="flex-1"
              value={af.issueDateTo}
              minDate={af.issueDateFrom || undefined}
              maxDate={new Date().toISOString().slice(0, 10)}
              onChange={(v: string) => setAdvancedFilters({ issueDateTo: v })}
            />
          </div>
        </FilterField>
        <FilterField label={t('advancedFilters.plannedDeliveryDate')}>
          <div className="flex gap-2">
            <DatePicker
              placeholder="From"
              className="flex-1"
              value={af.plannedDeliveryDateFrom}
              maxDate={af.plannedDeliveryDateTo || undefined}
              onChange={(v: string) => setAdvancedFilters({ plannedDeliveryDateFrom: v })}
            />
            <DatePicker
              placeholder="To"
              className="flex-1"
              value={af.plannedDeliveryDateTo}
              minDate={af.plannedDeliveryDateFrom || undefined}
              onChange={(v: string) => setAdvancedFilters({ plannedDeliveryDateTo: v })}
            />
          </div>
        </FilterField>

        {/* Row 3: Created by (under Project+Vendor), Last modified by (under PO status+PO type) */}
        <FilterField label={t('advancedFilters.createdBy')} className="sm:col-span-2">
          <SelectDropdown
            placeholder={t('advancedFilters.allUsers')}
            options={createdByOptions}
            selected={af.createdByUserId}
            onSelectedChange={(v: string[]) => setAdvancedFilters({ createdByUserId: v })}
          />
        </FilterField>
        <FilterField label={t('advancedFilters.lastModifiedBy')} className="sm:col-span-2">
          <SelectDropdown
            placeholder={t('advancedFilters.allUsers')}
            options={lastModifiedByOptions}
            selected={af.lastModifiedByUserId}
            onSelectedChange={(v: string[]) => setAdvancedFilters({ lastModifiedByUserId: v })}
          />
        </FilterField>
      </div>

      {/* ── Operational state section ── */}
      <div className="border-t border-border pt-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-muted-foreground">
            {t('advancedFilters.byOperationalState')}
          </p>
          <div className="flex items-center gap-4">
            <button
              type="button"
              disabled={allChecked}
              onClick={handleSelectAll}
              className="flex items-center gap-1 text-xs font-medium text-foreground hover:text-foreground/80 transition-colors disabled:opacity-40"
            >
              {t('advancedFilters.selectAll')} <span className="text-[10px]">&#10003;</span>
            </button>
            <button
              type="button"
              disabled={noneChecked}
              onClick={handleDeselectAll}
              className="flex items-center gap-1 text-xs font-medium text-foreground hover:text-foreground/80 transition-colors disabled:opacity-40"
            >
              {t('advancedFilters.deselectAll')} <span className="text-[10px]">&#10005;</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-6">
          {OPERATIONAL_STATE_KEYS.map((key) => (
            <Checkbox
              key={key}
              checked={af[key]}
              onChange={(checked) => setAdvancedFilters({ [key]: checked })}
              label={t(`advancedFilters.${key}` as never)}
            />
          ))}
        </div>
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
