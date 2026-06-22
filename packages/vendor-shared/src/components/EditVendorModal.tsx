import { useTranslation } from '@forethread/i18n';
import {
  GridModal,
  Input,
  FormField,
  Button,
  Alert,
  Spinner,
  onPhoneOnly,
} from '@forethread/ui-components';
import DepartmentIcon from '@forethread/ui-components/assets/icons/department.svg?react';
import EditIcon from '@forethread/ui-components/assets/icons/edit-without-line.svg?react';
import EnvelopeIcon from '@forethread/ui-components/assets/icons/envelope-simple.svg?react';
import IdBadgeIcon from '@forethread/ui-components/assets/icons/id-badge.svg?react';
import PhoneIcon from '@forethread/ui-components/assets/icons/phone.svg?react';
import UserOutlineIcon from '@forethread/ui-components/assets/icons/user-outline.svg?react';

import { useEditVendorForm } from '../hooks/useEditVendorForm';

interface EditVendorModalProps {
  onClose: () => void;
}

export function EditVendorModal({ onClose }: EditVendorModalProps) {
  const { t } = useTranslation(['vendors', 'common']);
  const { form, handleSubmit, updateMutation, isLoadingUser } = useEditVendorForm(onClose);
  const {
    register,
    formState: { errors },
  } = form;

  if (isLoadingUser) {
    return (
      <GridModal
        onClose={onClose}
        maxWidth="max-w-[560px]"
        icon={<EditIcon className="size-6 text-gray-700" />}
        title={t('editVendorModal.title')}
        description={t('editVendorModal.subtitle')}
      >
        <div className="flex items-center justify-center py-12">
          <Spinner size="md" />
        </div>
      </GridModal>
    );
  }

  return (
    <GridModal
      onClose={onClose}
      maxWidth="max-w-[560px]"
      icon={<EditIcon className="size-6 text-gray-700" />}
      title={t('editVendorModal.title')}
      description={t('editVendorModal.subtitle')}
      onSubmit={(e) => void handleSubmit(e)}
      actions={
        <>
          <Button type="submit" size="lg" isLoading={updateMutation.isPending} className="w-full">
            {updateMutation.isPending
              ? t('editVendorModal.submitting')
              : t('editVendorModal.submitChanges')}
          </Button>
          <Button variant="outline" size="lg" type="button" onClick={onClose} className="w-full">
            {t('common:cancel')}
          </Button>
        </>
      }
    >
      {/* Full Name */}
      <FormField label={t('editVendorModal.fullName')} error={errors.name?.message} required>
        <Input
          type="text"
          placeholder={t('editVendorModal.namePlaceholder')}
          leftIcon={<UserOutlineIcon className="w-5 h-5" />}
          {...register('name')}
        />
      </FormField>

      {/* Email + Phone */}
      <div className="grid grid-cols-2 gap-3">
        <FormField label={t('editVendorModal.email')} error={errors.email?.message} required>
          <Input
            type="email"
            placeholder={t('editVendorModal.emailPlaceholder')}
            leftIcon={<EnvelopeIcon className="w-5 h-5" />}
            disabled
            {...register('email')}
          />
        </FormField>

        <FormField label={t('editVendorModal.phone')} error={errors.phone?.message}>
          <Input
            type="tel"
            inputMode="tel"
            onKeyDown={onPhoneOnly}
            placeholder={t('editVendorModal.phonePlaceholder')}
            leftIcon={<PhoneIcon className="w-5 h-5" />}
            {...register('phone')}
          />
        </FormField>
      </div>

      {/* Position (optional) */}
      <div>
        <label className="block mb-1.5">
          <span className="text-sm font-medium text-card-foreground">
            {t('editVendorModal.position')}&nbsp;
            <span className="text-muted-foreground font-normal">({t('common:optional')})</span>
          </span>
        </label>
        <Input
          type="text"
          placeholder={t('editVendorModal.positionPlaceholder')}
          leftIcon={<IdBadgeIcon className="w-5 h-5" />}
          {...register('position')}
        />
      </div>

      {/* Department (optional) — UI only, not sent to API */}
      <div>
        <label className="block mb-1.5">
          <span className="text-sm font-medium text-card-foreground">
            {t('editVendorModal.department')}&nbsp;
            <span className="text-muted-foreground font-normal">({t('common:optional')})</span>
          </span>
        </label>
        <Input
          type="text"
          placeholder={t('editVendorModal.departmentPlaceholder')}
          leftIcon={<DepartmentIcon className="w-5 h-5" />}
          {...register('department')}
        />
      </div>

      {/* Error alert */}
      {updateMutation.isError && (
        <Alert variant="destructive">{t('editVendorModal.updateError')}</Alert>
      )}
    </GridModal>
  );
}
