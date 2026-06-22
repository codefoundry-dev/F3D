import { searchAddresses } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { AddressInput, Button, GridModal, Input } from '@forethread/ui-components';
import LocationIcon from '@forethread/ui-components/assets/icons/location.svg?react';
import { useCallback, useState } from 'react';

const PLACE_TYPES = {
  COUNTRY: ['country'] as string[],
  CITY: ['locality', 'administrative_area_level_1'] as string[],
  ADDRESS: ['street_address', 'route'] as string[],
};

export interface AddWarehouseModalProps {
  onClose: () => void;
  onSubmit: (warehouse: { name: string; address: string; city: string; postcode: string }) => void;
  isSubmitting?: boolean;
}

export function AddWarehouseModal({ onClose, onSubmit, isSubmitting }: AddWarehouseModalProps) {
  const { t } = useTranslation('rfqs');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [postcode, setPostcode] = useState('');

  const searchFn = useCallback(
    (input: string, types?: string[], locationContext?: string) =>
      searchAddresses(input, undefined, types, locationContext),
    [],
  );

  const isValid = country.trim() && city.trim() && address.trim();

  const handleSubmit = () => {
    if (!isValid) return;
    onSubmit({
      name: country.trim(),
      address: address.trim(),
      city: city.trim(),
      postcode: postcode.trim(),
    });
  };

  return (
    <GridModal
      onClose={onClose}
      size="lg"
      icon={<LocationIcon className="size-6 text-gray-700" />}
      title={t('response.addWarehouseTitle')}
      description={t('response.addWarehouseSubtitle')}
      actions={
        <>
          <Button
            variant="primary"
            className="w-full"
            onClick={handleSubmit}
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting ? t('response.adding') : t('response.addWarehouse')}
          </Button>
          <Button variant="outline" className="w-full" onClick={onClose}>
            {t('response.cancel')}
          </Button>
        </>
      }
    >
      <div>
        <label className="text-sm font-medium text-foreground mb-1.5 block">
          {t('response.warehouseCountry', { defaultValue: 'Country' })}
        </label>
        <AddressInput
          value={country}
          onChange={(val) => {
            setCountry(val);
            setCity('');
            setAddress('');
            setPostcode('');
          }}
          searchFn={searchFn}
          types={PLACE_TYPES.COUNTRY}
          placeholder={t('response.warehouseCountryPlaceholder', { defaultValue: 'Country' })}
        />
      </div>
      <div>
        <label className="text-sm font-medium text-foreground mb-1.5 block">
          {t('response.warehouseCity')}
        </label>
        <AddressInput
          value={city}
          onChange={(val) => {
            setCity(val);
            setAddress('');
            setPostcode('');
          }}
          searchFn={searchFn}
          types={PLACE_TYPES.CITY}
          locationContext={country || undefined}
          disabled={!country}
          placeholder={t('response.warehouseCityPlaceholder')}
        />
      </div>
      <div>
        <label className="text-sm font-medium text-foreground mb-1.5 block">
          {t('response.warehouseAddress')}
        </label>
        <AddressInput
          value={address}
          onChange={(val) => setAddress(val)}
          searchFn={searchFn}
          types={PLACE_TYPES.ADDRESS}
          locationContext={city && country ? `${city}, ${country}` : undefined}
          disabled={!city}
          placeholder={t('response.warehouseAddressPlaceholder')}
        />
      </div>
      <div>
        <label className="text-sm font-medium text-foreground mb-1.5 block">
          {t('response.warehousePostcode')}
        </label>
        <Input
          value={postcode}
          onChange={(e) => setPostcode(e.target.value)}
          disabled={!city}
          placeholder={t('response.warehousePostcodePlaceholder')}
        />
      </div>
    </GridModal>
  );
}
