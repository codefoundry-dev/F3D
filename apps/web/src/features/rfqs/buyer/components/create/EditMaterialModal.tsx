import { useTranslation } from '@forethread/i18n';
import { Button, DatePicker, GridModal, Input, Textarea } from '@forethread/ui-components';
import EditIcon from '@forethread/ui-components/assets/icons/edit.svg?react';
import { useState } from 'react';

import type { DeliveryLocationOption } from './StepBasicInfo';
import type { WizardLineItem } from './wizard-types';

interface EditMaterialModalProps {
  item: WizardLineItem;
  locationOptions: DeliveryLocationOption[];
  onConfirm: (patch: Partial<WizardLineItem>) => void;
  onClose: () => void;
}

/**
 * "Edit material" dialog (Figma 5.05): name, description, unit + quantity,
 * expected delivery date + delivery location, optional note.
 */
export function EditMaterialModal({
  item,
  locationOptions,
  onConfirm,
  onClose,
}: EditMaterialModalProps) {
  const { t } = useTranslation('rfqs');
  const [name, setName] = useState(item.materialName);
  const [description, setDescription] = useState(item.description ?? '');
  const [uom, setUom] = useState(item.uom);
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [expectedDate, setExpectedDate] = useState(item.expectedDeliveryDate ?? '');
  const [locationId, setLocationId] = useState(item.deliveryLocationId ?? '');
  const [notes, setNotes] = useState(item.notes ?? '');
  const [error, setError] = useState<string | null>(null);

  const locations = locationOptions.filter(
    (location) => !item.projectId || location.projectId === item.projectId,
  );

  const handleConfirm = () => {
    const qty = Number(quantity);
    if (!name.trim() || !uom.trim() || Number.isNaN(qty) || qty < 0.01) {
      setError(t('create.editMaterial.invalid'));
      return;
    }
    onConfirm({
      materialName: name.trim(),
      description: description.trim() || undefined,
      uom: uom.trim(),
      quantity: qty,
      expectedDeliveryDate: expectedDate || undefined,
      deliveryLocationId: locationId || undefined,
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  const requiredMark = <span className="text-destructive">*</span>;

  return (
    <GridModal
      onClose={onClose}
      size="lg"
      icon={<EditIcon className="size-6 text-gray-700" />}
      title={t('create.editMaterial.title')}
      description={t('create.editMaterial.subtitle')}
      actions={
        <>
          <Button
            type="button"
            className="w-full h-12"
            onClick={handleConfirm}
            data-testid="edit-material-confirm"
          >
            {t('create.editMaterial.confirm')}
          </Button>
          <Button type="button" variant="ghost" className="w-full" onClick={onClose}>
            {t('create.editMaterial.cancel')}
          </Button>
        </>
      }
    >
      <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
        <span>
          {t('create.editMaterial.materialName')} {requiredMark}
        </span>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          data-testid="edit-material-name"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
        <span>
          {t('create.editMaterial.description')} {requiredMark}
        </span>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
          <span>
            {t('create.editMaterial.unit')} {requiredMark}
          </span>
          <Input
            value={uom}
            onChange={(e) => setUom(e.target.value)}
            data-testid="edit-material-uom"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
          <span>
            {t('create.editMaterial.quantity')} {requiredMark}
          </span>
          <Input
            inputMode="numeric"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            data-testid="edit-material-qty"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
          <span>{t('create.editMaterial.expDeliveryDate')}</span>
          <DatePicker
            value={expectedDate}
            onChange={setExpectedDate}
            editable
            placeholder="mm/dd/yyyy"
          />
        </div>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
          <span>{t('create.editMaterial.deliveryLocation')}</span>
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="h-12 rounded-xl border border-foreground/20 bg-background px-3 text-sm text-foreground focus:outline-none focus:border-foreground/40"
          >
            <option value="">—</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
        <span>
          {t('create.editMaterial.note')}{' '}
          <span className="text-muted-foreground font-normal">({t('create.optional')})</span>
        </span>
        <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </GridModal>
  );
}
