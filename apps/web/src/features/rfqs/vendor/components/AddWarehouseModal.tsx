import { searchAddresses } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  AddressInput,
  Button,
  Input,
  Modal,
  ModalBody,
  ModalIconHeader,
} from '@forethread/ui-components';
import WarehouseIcon from '@forethread/ui-components/assets/icons/settings.svg?react';
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
    <Modal onClose={onClose} maxWidth="max-w-[560px]">
      <ModalBody>
        <ModalIconHeader
          icon={<WarehouseIcon className="w-6 h-6 text-foreground" />}
          title={t('response.addWarehouseTitle')}
          subtitle={t('response.addWarehouseSubtitle')}
          onClose={onClose}
        />

        <div className="mt-4 flex flex-col gap-4">
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
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            {t('response.cancel')}
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            onClick={handleSubmit}
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting ? t('response.adding') : t('response.addWarehouse')}
          </Button>
        </div>
      </ModalBody>
    </Modal>
  );
}
