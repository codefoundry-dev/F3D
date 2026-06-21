import { useTranslation } from '@forethread/i18n';
import {
  Modal,
  ModalBody,
  ModalHeader,
  Input,
  Textarea,
  Select,
  FileDropzone,
} from '@forethread/ui-components';
import { useState } from 'react';

import { PrimaryButton } from './MobileButtons';

/** Payload emitted when a free-text material is added on the Manual tab. */
export interface NewMaterialDraft {
  materialName: string;
  unit: string;
  quantity: number;
  description?: string;
}

export interface NewMaterialModalProps {
  onClose: () => void;
  onAdd: (draft: NewMaterialDraft) => void;
}

const UNIT_OPTION_KEYS = [
  ['Each', 'newMaterial.unitEach'],
  ['Box', 'newMaterial.unitBox'],
  ['Roll', 'newMaterial.unitRoll'],
  ['Sheet', 'newMaterial.unitSheet'],
  ['Gallon', 'newMaterial.unitGallon'],
  ['Bag', 'newMaterial.unitBag'],
  ['Linear Foot', 'newMaterial.unitLinearFoot'],
  ['Square Foot', 'newMaterial.unitSquareFoot'],
  ['Cubic Yard', 'newMaterial.unitCubicYard'],
] as const;

/**
 * "New Material" modal (Figma 2002:176 frames 2157:1261 / 2157:1266). Captures a
 * free-text line: name*, unit, quantity*, optional photo + description. The
 * photo is collected for parity with the design but not uploaded (the create-MR
 * API has no per-line image field) — noted as a follow-up.
 */
export function NewMaterialModal({ onClose, onAdd }: NewMaterialModalProps) {
  const { t } = useTranslation('materialRequests');
  const [name, setName] = useState('');
  const [unit, setUnit] = useState<string>('Each');
  const [quantity, setQuantity] = useState('0');
  const [description, setDescription] = useState('');
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const qtyNum = Number(quantity);
  const nameValid = name.trim().length > 0;
  const qtyValid = Number.isFinite(qtyNum) && qtyNum > 0;
  const canAdd = nameValid && qtyValid;

  const handleAdd = () => {
    setTouched(true);
    if (!canAdd) return;
    onAdd({
      materialName: name.trim(),
      unit,
      quantity: qtyNum,
      description: description.trim() || undefined,
    });
  };

  return (
    <Modal onClose={onClose} maxWidth="max-w-md" scrollBody>
      <ModalHeader onClose={onClose}>{t('newMaterial.title')}</ModalHeader>
      <ModalBody className="space-y-4">
        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-1 text-sm font-medium text-foreground">
            {t('newMaterial.materialName')}
            <span className="text-muted-foreground">*</span>
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('newMaterial.materialNamePlaceholder')}
            aria-label={t('newMaterial.materialName')}
            data-testid="mr-new-material-name"
          />
          {touched && !nameValid && (
            <p className="text-xs text-destructive">{t('newMaterial.materialName')}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">{t('newMaterial.unit')}</label>
          <Select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            aria-label={t('newMaterial.unit')}
          >
            {UNIT_OPTION_KEYS.map(([value, key]) => (
              <option key={value} value={value}>
                {t(key as never)}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-1 text-sm font-medium text-foreground">
            {t('newMaterial.quantity')}
            <span className="text-muted-foreground">*</span>
          </label>
          <Input
            type="number"
            min={0}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            aria-label={t('newMaterial.quantity')}
            data-testid="mr-new-material-qty"
          />
          {touched && !qtyValid && (
            <p className="text-xs text-destructive">{t('newMaterial.quantity')}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-1 text-sm font-medium text-foreground">
            {t('newMaterial.addPhoto')}
            <span className="text-muted-foreground">({t('newMaterial.optional')})</span>
          </label>
          <FileDropzone
            accept="image/png,image/jpeg"
            buttonLabel={t('newMaterial.addPhotoHint')}
            hint={t('newMaterial.addPhotoFormats')}
            onFiles={(files) => {
              const first = Array.from(files)[0];
              setPhotoName(first ? first.name : null);
            }}
          />
          {photoName && <p className="text-xs text-muted-foreground">{photoName}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-1 text-sm font-medium text-foreground">
            {t('newMaterial.description')}
            <span className="text-muted-foreground">({t('newMaterial.optional')})</span>
          </label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('newMaterial.descriptionPlaceholder')}
            rows={3}
            aria-label={t('newMaterial.description')}
          />
        </div>

        <PrimaryButton
          onClick={handleAdd}
          disabled={!canAdd}
          className="w-full"
          data-testid="mr-new-material-add"
        >
          {t('newMaterial.add')}
        </PrimaryButton>
      </ModalBody>
    </Modal>
  );
}
