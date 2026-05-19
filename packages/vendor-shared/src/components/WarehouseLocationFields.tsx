import { useTranslation } from '@forethread/i18n';
import { FormField, Input, AddressInput } from '@forethread/ui-components';
import EnvelopeIcon from '@forethread/ui-components/assets/icons/envelope-simple.svg?react';

import { PLACE_TYPES } from '../constants';

export interface WarehouseData {
  name: string;
  city: string;
  address: string;
  postcode: string;
}

interface WarehouseLocationFieldsProps {
  data: WarehouseData;
  onChange: (data: WarehouseData) => void;
  searchFn: (input: string, types?: string[], locationContext?: string) => Promise<string[]>;
  disabled?: boolean;
  errors?: Record<string, string>;
}

export function WarehouseLocationFields({
  data,
  onChange,
  searchFn,
  disabled,
  errors,
}: WarehouseLocationFieldsProps) {
  const { t } = useTranslation(['vendors']);

  const updateField = (patch: Partial<WarehouseData>) => {
    onChange({ ...data, ...patch });
  };

  return (
    <div className="grid grid-cols-4 gap-6 w-full">
      <FormField
        label={t('vendors:fields.country', { defaultValue: 'Country' })}
        error={errors?.name}
      >
        <AddressInput
          placeholder={t('vendors:fields.countryPlaceholder', { defaultValue: 'Country' })}
          value={data.name}
          searchFn={searchFn}
          types={PLACE_TYPES.COUNTRY}
          disabled={disabled}
          onChange={(val) => updateField({ name: val, city: '', address: '', postcode: '' })}
        />
      </FormField>
      <FormField label={t('vendors:fields.city', { defaultValue: 'City' })} error={errors?.city}>
        <AddressInput
          placeholder={t('vendors:fields.cityPlaceholder', { defaultValue: 'City' })}
          value={data.city}
          searchFn={searchFn}
          types={PLACE_TYPES.CITY}
          locationContext={data.name}
          disabled={disabled || !data.name}
          onChange={(val) => updateField({ city: val, address: '', postcode: '' })}
        />
      </FormField>
      <FormField
        label={t('vendors:fields.address', { defaultValue: 'Address' })}
        error={errors?.address}
      >
        <AddressInput
          placeholder={t('vendors:fields.addressPlaceholder', { defaultValue: 'Address' })}
          value={data.address}
          searchFn={searchFn}
          types={PLACE_TYPES.ADDRESS}
          locationContext={data.city && data.name ? `${data.city}, ${data.name}` : undefined}
          disabled={disabled || !data.city}
          onChange={(val) => updateField({ address: val })}
        />
      </FormField>
      <FormField
        label={t('vendors:fields.postcode', { defaultValue: 'Postcode' })}
        error={errors?.postcode}
      >
        <Input
          leftIcon={<EnvelopeIcon className="w-5 h-5" />}
          placeholder={t('vendors:fields.postcodePlaceholder', { defaultValue: 'Postcode' })}
          value={data.postcode}
          disabled={disabled || !data.city}
          onChange={(e) => updateField({ postcode: e.target.value })}
        />
      </FormField>
    </div>
  );
}
