import type { WarehouseLocation } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { Input, SelectDropdown } from '@forethread/ui-components';

const PAYMENT_TERMS_PATTERN = /^[0-9]+(-[0-9]*)?$/;

interface PoVendorAcceptFieldsProps {
  paymentTermsDays: string;
  onPaymentTermsChange: (value: string) => void;
  warehouseLocationId: string;
  onWarehouseChange: (value: string) => void;
  warehouseLocations: WarehouseLocation[];
}

export function PoVendorAcceptFields({
  paymentTermsDays,
  onPaymentTermsChange,
  warehouseLocationId,
  onWarehouseChange,
  warehouseLocations,
}: PoVendorAcceptFieldsProps) {
  const { t } = useTranslation('purchaseOrders');

  const warehouseOptions = warehouseLocations.map((wh) => ({
    value: wh.id,
    label: `${wh.name} — ${wh.address}, ${wh.city}`,
  }));

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-normal leading-[14px] text-muted-foreground">
          {t('detailFields.paymentTermsDays')}
        </label>
        <Input
          value={paymentTermsDays}
          onChange={(e) => {
            const v = e.target.value;
            if (v === '' || PAYMENT_TERMS_PATTERN.test(v)) {
              onPaymentTermsChange(v);
            }
          }}
          placeholder="15-30"
          className="h-10 bg-muted text-base font-normal leading-6 text-foreground truncate"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-normal leading-[14px] text-muted-foreground">
          {t('detailFields.warehouseLocation')}
        </label>
        <SelectDropdown
          value={warehouseLocationId}
          onChange={onWarehouseChange}
          options={warehouseOptions}
          placeholder={t('create.deliveryLocationPlaceholder')}
          className="[&_button]:h-10 [&_button]:text-base [&_button]:font-normal [&_button]:leading-6 [&_button]:text-foreground [&_button_span]:truncate"
        />
      </div>
    </>
  );
}
