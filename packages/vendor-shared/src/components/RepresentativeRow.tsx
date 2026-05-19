import type { VendorRepresentative } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { FormField, Input, onPhoneOnly } from '@forethread/ui-components';
import DeleteIcon from '@forethread/ui-components/assets/icons/delete.svg?react';
import EnvelopeIcon from '@forethread/ui-components/assets/icons/envelope-simple.svg?react';
import IdBadgeIcon from '@forethread/ui-components/assets/icons/id-badge.svg?react';
import PhoneIcon from '@forethread/ui-components/assets/icons/phone.svg?react';
import UserIcon from '@forethread/ui-components/assets/icons/user-outline.svg?react';

import { InfoItem } from './InfoItem';

export interface RepEdit {
  name: string;
  phone: string;
  position: string;
}

export interface RepErrors {
  name?: string;
  email?: string;
  phone?: string;
  position?: string;
}

interface RepresentativeRowProps {
  rep: VendorRepresentative;
  isEditing: boolean;
  editData?: RepEdit;
  onFieldChange?: (field: keyof RepEdit, value: string) => void;
  /** If true, email is editable (for new reps not yet saved) */
  isNew?: boolean;
  /** Email value for new reps */
  emailValue?: string;
  onEmailChange?: (value: string) => void;
  onRemove?: () => void;
  errors?: RepErrors;
}

export function RepresentativeRow({
  rep,
  isEditing,
  editData,
  onFieldChange,
  isNew,
  emailValue,
  onEmailChange,
  onRemove,
  errors,
}: RepresentativeRowProps) {
  const { t } = useTranslation(['vendors']);

  if (isEditing && editData && onFieldChange) {
    return (
      <div className="grid grid-cols-4 gap-6">
        <FormField
          label={t('vendors:fields.fullName', { defaultValue: 'Full name' })}
          error={errors?.name}
        >
          <Input
            leftIcon={<UserIcon className="w-5 h-5" />}
            value={editData.name}
            onChange={(e) => onFieldChange('name', e.target.value)}
          />
        </FormField>
        <FormField
          label={t('vendors:fields.contactEmail', { defaultValue: 'Contact Email' })}
          error={errors?.email}
        >
          <Input
            leftIcon={<EnvelopeIcon className="w-5 h-5" />}
            value={isNew ? (emailValue ?? '') : rep.email}
            readOnly={!isNew}
            disabled={!isNew}
            onChange={isNew && onEmailChange ? (e) => onEmailChange(e.target.value) : undefined}
          />
        </FormField>
        <FormField
          label={t('vendors:fields.phoneNumber', { defaultValue: 'Phone Number' })}
          error={errors?.phone}
        >
          <Input
            leftIcon={<PhoneIcon className="w-5 h-5" />}
            value={editData.phone}
            onChange={(e) => onFieldChange('phone', e.target.value)}
            onKeyDown={onPhoneOnly}
          />
        </FormField>
        <FormField
          label={t('vendors:fields.position', { defaultValue: 'Position' })}
          error={errors?.position}
        >
          <div className="flex gap-2">
            <Input
              leftIcon={<IdBadgeIcon className="w-5 h-5" />}
              value={editData.position}
              onChange={(e) => onFieldChange('position', e.target.value)}
            />
            {onRemove && (
              <button
                type="button"
                className="p-2 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                onClick={onRemove}
              >
                <DeleteIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </FormField>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-6">
      <InfoItem
        icon={<UserIcon className="w-4 h-4" />}
        label={t('vendors:fields.fullName', { defaultValue: 'Full name' })}
        value={rep.name}
      />
      <InfoItem
        icon={<EnvelopeIcon className="w-4 h-4" />}
        label={t('vendors:fields.contactEmail', { defaultValue: 'Contact Email' })}
        value={rep.email}
      />
      <InfoItem
        icon={<PhoneIcon className="w-4 h-4" />}
        label={t('vendors:fields.phoneNumber', { defaultValue: 'Phone Number' })}
        value={rep.phone}
      />
      <InfoItem
        icon={<IdBadgeIcon className="w-4 h-4" />}
        label={t('vendors:fields.position', { defaultValue: 'Position' })}
        value={rep.position}
      />
    </div>
  );
}
