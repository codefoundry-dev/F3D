import type { WarehouseLocation } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { Button } from '@forethread/ui-components';
import DeleteIcon from '@forethread/ui-components/assets/icons/delete.svg?react';
import EditIcon from '@forethread/ui-components/assets/icons/edit-without-line.svg?react';
import EnvelopeIcon from '@forethread/ui-components/assets/icons/envelope-simple.svg?react';
import LocationIcon from '@forethread/ui-components/assets/icons/location.svg?react';
import { useState } from 'react';

import { useUpdateWarehouse } from '../services';

import { InfoItem } from './InfoItem';
import { WarehouseLocationFields, type WarehouseData } from './WarehouseLocationFields';

interface WarehouseCardProps {
  vendorId: string;
  warehouse: WarehouseLocation;
  isPageEditing: boolean;
  onDelete: () => void;
  /** Called when fields change in page-edit mode so parent can batch-save on Submit */
  onPageEditChange?: (data: WarehouseData) => void;
  searchFn: (input: string, types?: string[], locationContext?: string) => Promise<string[]>;
}

export function WarehouseCard({
  vendorId,
  warehouse,
  isPageEditing,
  onDelete,
  onPageEditChange,
  searchFn,
}: WarehouseCardProps) {
  const { t } = useTranslation(['vendors', 'common']);
  const [isCardEditing, setIsCardEditing] = useState(false);
  const [editData, setEditData] = useState<WarehouseData>({
    name: warehouse.name,
    city: warehouse.city,
    address: warehouse.address,
    postcode: warehouse.postcode,
  });
  const updateWarehouseMutation = useUpdateWarehouse();

  const isEditing = isPageEditing || isCardEditing;

  const isCardDirty =
    editData.name !== warehouse.name ||
    editData.city !== warehouse.city ||
    editData.address !== warehouse.address ||
    editData.postcode !== warehouse.postcode;

  const isCardValid = !!(editData.name && editData.city && editData.address && editData.postcode);

  const handleSave = async () => {
    if (!isCardValid) return;
    await updateWarehouseMutation.mutateAsync({
      vendorId,
      warehouseId: warehouse.id,
      input: editData,
    });
    setIsCardEditing(false);
  };

  const handleCancel = () => {
    setEditData({
      name: warehouse.name,
      city: warehouse.city,
      address: warehouse.address,
      postcode: warehouse.postcode,
    });
    setIsCardEditing(false);
  };

  return (
    <div className="flex flex-col items-start gap-2 self-stretch p-4 rounded-[10px] border-[0.8px] border-solid border-foreground/10">
      <div className="flex items-center gap-2 w-full">
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <WarehouseLocationFields
              data={editData}
              onChange={(data) => {
                setEditData(data);
                if (isPageEditing) onPageEditChange?.(data);
              }}
              searchFn={searchFn}
            />
          ) : (
            <div className="grid grid-cols-4 gap-6">
              <InfoItem
                icon={<LocationIcon className="w-4 h-4" />}
                label={t('vendors:fields.country', { defaultValue: 'Country' })}
                value={warehouse.name}
              />
              <InfoItem
                icon={<LocationIcon className="w-4 h-4" />}
                label={t('vendors:fields.city', { defaultValue: 'City' })}
                value={warehouse.city}
              />
              <InfoItem
                icon={<LocationIcon className="w-4 h-4" />}
                label={t('vendors:fields.address', { defaultValue: 'Address' })}
                value={warehouse.address}
              />
              <InfoItem
                icon={<EnvelopeIcon className="w-4 h-4" />}
                label={t('vendors:fields.postcode', { defaultValue: 'Postcode' })}
                value={warehouse.postcode}
              />
            </div>
          )}
        </div>

        {/* Icons — inline, not absolute */}
        {!isCardEditing && (
          <div className="flex items-center gap-1 shrink-0 self-start mt-2">
            {!isPageEditing && (
              <button
                type="button"
                className="flex items-center justify-center w-6 h-6 text-black transition-colors"
                aria-label="Edit warehouse"
                onClick={() => setIsCardEditing(true)}
              >
                <EditIcon className="w-[18px] h-[19.5px]" />
              </button>
            )}
            <button
              type="button"
              className="flex items-center justify-center w-6 h-6 text-black transition-colors"
              aria-label="Delete warehouse"
              onClick={onDelete}
            >
              <DeleteIcon className="w-[18px] h-[19.5px]" />
            </button>
          </div>
        )}
      </div>

      {/* Save/Cancel buttons when card-editing */}
      {isCardEditing && (
        <div className="flex items-center gap-3 w-full">
          <Button
            size="sm"
            onClick={handleSave}
            isLoading={updateWarehouseMutation.isPending}
            disabled={!isCardDirty || !isCardValid}
          >
            {t('common:save', { defaultValue: 'Save' })}
          </Button>
          <Button size="sm" variant="outline" onClick={handleCancel}>
            {t('common:cancel', { defaultValue: 'Cancel' })}
          </Button>
        </div>
      )}
    </div>
  );
}
