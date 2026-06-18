import { useTranslation } from '@forethread/i18n';
import { DamageDisposition, DamageType } from '@forethread/shared-types/client';
import { Select, StepperInput, RadioGroup, Button, FileChip } from '@forethread/ui-components';
import PaperclipIcon from '@forethread/ui-components/assets/icons/paperclip.svg?react';
import { useRef } from 'react';

import { DAMAGE_TYPE_OPTIONS, DELIVERY_ATTACHMENT_ACCEPT } from '../constants';

/** The damage sub-form's draft state, owned by the create-page row. */
export interface DamageDraft {
  damagedQuantity: string;
  damageType: DamageType | '';
  damageDisposition: DamageDisposition | null;
  /** Photos selected client-side; uploaded after the report is created. */
  photos: File[];
}

export const EMPTY_DAMAGE_DRAFT: DamageDraft = {
  damagedQuantity: '0',
  damageType: '',
  damageDisposition: null,
  photos: [],
};

interface DamageDetailsFormProps {
  value: DamageDraft;
  onChange: (next: DamageDraft) => void;
  /** Line ref, used to build accessible labels / testids. */
  lineRef?: string;
}

/**
 * Inline "Damage details" sub-form revealed when a line's outcome is DAMAGED
 * (screenshots 06/07). Damaged qty stepper + Type dropdown + Disposition radios
 * + photo evidence picker. Pure controlled component — the parent persists the
 * draft and uploads the photos after the report is created.
 */
export function DamageDetailsForm({ value, onChange, lineRef }: DamageDetailsFormProps) {
  const { t } = useTranslation('deliveries');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addPhotos = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    onChange({ ...value, photos: [...value.photos, ...Array.from(files)] });
  };

  const removePhoto = (index: number) =>
    onChange({ ...value, photos: value.photos.filter((_, i) => i !== index) });

  return (
    <div className="bg-card" data-testid={`delivery-damage-form-${lineRef ?? ''}`}>
      <h4 className="text-sm font-semibold text-foreground mb-4">{t('damage.title')}</h4>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:gap-8">
        {/* Damaged qty */}
        <div className="flex flex-col gap-1.5 lg:w-[240px]">
          <label className="text-xs font-medium text-muted-foreground">
            {t('damage.damagedQty')}
          </label>
          <StepperInput
            value={value.damagedQuantity}
            onValueChange={(v) => onChange({ ...value, damagedQuantity: v })}
            min={0}
            aria-label={t('damage.damagedQty')}
          />
        </div>

        {/* Type */}
        <div className="flex flex-col gap-1.5 lg:w-[240px]">
          <label className="text-xs font-medium text-muted-foreground">{t('damage.type')}</label>
          <Select
            value={value.damageType}
            onChange={(e) => onChange({ ...value, damageType: e.target.value as DamageType | '' })}
            aria-label={t('damage.type')}
          >
            <option value="">{t('damage.typePlaceholder')}</option>
            {DAMAGE_TYPE_OPTIONS.map((dt) => (
              <option key={dt} value={dt}>
                {t(`damageType.${dt}` as never)}
              </option>
            ))}
          </Select>
        </div>

        {/* Disposition */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            {t('damage.disposition')}
          </label>
          <RadioGroup
            value={value.damageDisposition}
            onChange={(v) => onChange({ ...value, damageDisposition: v as DamageDisposition })}
            options={[
              { value: DamageDisposition.RETURNED, label: t('damage.returned') },
              { value: DamageDisposition.ACCEPTED, label: t('damage.accepted') },
            ]}
          />
        </div>

        {/* Add Photo evidence */}
        <div className="lg:ml-auto">
          <input
            ref={fileInputRef}
            type="file"
            accept={DELIVERY_ATTACHMENT_ACCEPT}
            multiple
            className="hidden"
            onChange={(e) => {
              addPhotos(e.target.files);
              e.target.value = '';
            }}
          />
          <Button
            variant="outline"
            leftIcon={<PaperclipIcon className="w-4 h-4" />}
            onClick={() => fileInputRef.current?.click()}
            data-testid={`delivery-add-photo-${lineRef ?? ''}`}
          >
            {t('damage.addPhoto')}
          </Button>
        </div>
      </div>

      {value.photos.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4">
          {value.photos.map((file, i) => (
            <FileChip key={`${file.name}-${i}`} name={file.name} onRemove={() => removePhoto(i)} />
          ))}
        </div>
      )}
    </div>
  );
}
