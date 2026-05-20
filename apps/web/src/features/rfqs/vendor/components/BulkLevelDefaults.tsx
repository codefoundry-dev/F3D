import type { WarehouseLocation } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  Button,
  cn,
  CustomDropdown,
  DatePicker,
  Input,
  onDecimalOnly,
  onDigitsOnly,
} from '@forethread/ui-components';
import ChevronDownIcon from '@forethread/ui-components/assets/icons/chevron-down.svg?react';

import type { BulkDefaults } from '../hooks/useRfqResponse';

export interface BulkLevelDefaultsProps {
  bulkDefaults: BulkDefaults;
  onFieldChange: (field: keyof BulkDefaults, value: string) => void;
  expanded: boolean;
  onToggleExpanded: (v: boolean) => void;
  warehouses: WarehouseLocation[];
  warehousesLoading: boolean;
  onAddWarehouse?: () => void;
}

export function BulkLevelDefaults({
  bulkDefaults,
  onFieldChange,
  expanded,
  onToggleExpanded,
  warehouses,
  warehousesLoading,
  onAddWarehouse,
}: BulkLevelDefaultsProps) {
  const { t } = useTranslation('rfqs');

  return (
    <div className="rounded-xl border border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-baseline gap-2">
          <h3 className="text-sm font-semibold text-foreground">{t('response.bulkDefaults')}</h3>
          <span className="text-xs text-muted-foreground">{t('response.appliedToAll')}</span>
        </div>
        <Button variant="outline" size="sm" onClick={() => onToggleExpanded(!expanded)}>
          <ChevronDownIcon
            className={cn('w-4 h-4 transition-transform', expanded && 'rotate-180')}
          />
          <span className="ml-1">{expanded ? t('response.collapse') : t('response.expand')}</span>
        </Button>
      </div>

      {/* Collapsible content */}
      {expanded && (
        <div className="px-4 pb-4 flex flex-col gap-4">
          {/* Row 1 */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                {t('response.bulkAvailability')}
              </label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder={t('response.enterNumber')}
                value={bulkDefaults.bulkAvailability}
                onChange={(e) => onFieldChange('bulkAvailability', e.target.value)}
                onKeyDown={onDigitsOnly}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                {t('response.bulkDiscount')}
              </label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder={t('response.enterNumber')}
                value={bulkDefaults.bulkDiscount}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '' || parseFloat(v) <= 100) onFieldChange('bulkDiscount', v);
                }}
                onKeyDown={onDecimalOnly}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                {t('response.generalSalesTax')}
              </label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder={t('response.enterNumber')}
                value={bulkDefaults.bulkTax}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '' || parseFloat(v) <= 100) onFieldChange('bulkTax', v);
                }}
                onKeyDown={onDecimalOnly}
              />
            </div>
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                {t('response.shipment')}
              </label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder={t('response.enterNumber')}
                value={bulkDefaults.shipment}
                onChange={(e) => onFieldChange('shipment', e.target.value)}
                onKeyDown={onDigitsOnly}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                {t('response.warehouseLocation')}
              </label>
              <CustomDropdown
                options={warehouses.map((wh) => ({
                  value: wh.id,
                  label: [wh.address, wh.city, wh.name, wh.postcode].filter(Boolean).join(', '),
                }))}
                value={bulkDefaults.warehouseLocationId}
                onChange={(val) => onFieldChange('warehouseLocationId', val)}
                placeholder={t('response.selectWarehouse')}
                disabled={warehousesLoading}
                actionItem={
                  onAddWarehouse
                    ? {
                        label: `+ ${t('response.addNewWarehouse')}`,
                        onClick: onAddWarehouse,
                      }
                    : undefined
                }
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                {t('response.bulkDeliveryDateTime')}
              </label>
              <DatePicker
                value={bulkDefaults.bulkDeliveryTime}
                onChange={(date) => onFieldChange('bulkDeliveryTime', date)}
                minDate={new Date().toISOString().slice(0, 10)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
