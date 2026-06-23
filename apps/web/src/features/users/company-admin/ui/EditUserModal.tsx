import { useTranslation } from '@forethread/i18n';
import {
  GridModal,
  Modal,
  ModalGridBackground,
  Input,
  FormField,
  Button,
  Alert,
  CustomDropdown,
  Spinner,
  onPhoneOnly,
} from '@forethread/ui-components';
import BriefcaseIcon from '@forethread/ui-components/assets/icons/briefcase.svg?react';
import DepartmentIcon from '@forethread/ui-components/assets/icons/department.svg?react';
import EditIcon from '@forethread/ui-components/assets/icons/edit-without-line.svg?react';
import EnvelopeIcon from '@forethread/ui-components/assets/icons/envelope-simple.svg?react';
import IdBadgeIcon from '@forethread/ui-components/assets/icons/id-badge.svg?react';
import PhoneIcon from '@forethread/ui-components/assets/icons/phone.svg?react';
import UserOutlineIcon from '@forethread/ui-components/assets/icons/user-outline.svg?react';
import { Controller } from 'react-hook-form';

import { useEditUserForm } from '../hooks/useEditUserForm';
import { useRoleOptions } from '../hooks/useRoleOptions';

interface EditUserModalProps {
  onClose: () => void;
}

export function EditUserModal({ onClose }: EditUserModalProps) {
  const { t } = useTranslation(['users', 'common']);
  const roleOptions = useRoleOptions();
  const { form, handleSubmit, updateMutation, isLoadingUser } = useEditUserForm(onClose);
  const {
    register,
    control,
    formState: { errors },
  } = form;

  if (isLoadingUser) {
    return (
      <Modal onClose={onClose} decoration={<ModalGridBackground />}>
        <div className="relative flex items-center justify-center py-12">
          <Spinner size="md" />
        </div>
      </Modal>
    );
  }

  return (
    <GridModal
      onClose={onClose}
      icon={<EditIcon className="size-6 text-gray-700" />}
      title={t('editModal.title')}
      description={t('editModal.subtitle')}
      onSubmit={(e) => void handleSubmit(e)}
      actions={
        <>
          <Button type="submit" size="lg" isLoading={updateMutation.isPending} className="w-full">
            {updateMutation.isPending ? t('editModal.submitting') : t('editModal.submitChanges')}
          </Button>
          <Button variant="outline" size="lg" type="button" onClick={onClose} className="w-full">
            {t('common:cancel')}
          </Button>
        </>
      }
    >
      {/* Full Name */}
      <FormField label={t('editModal.fullName')} error={errors.name?.message} labelSize="lg">
        <Input
          type="text"
          inputSize="lg"
          placeholder={t('editModal.namePlaceholder')}
          leftIcon={<UserOutlineIcon className="w-5 h-5" />}
          {...register('name')}
        />
      </FormField>

      {/* Email + Phone */}
      <div className="grid grid-cols-2 gap-3">
        <FormField label={t('editModal.email')} error={errors.email?.message} labelSize="lg">
          <Input
            type="email"
            inputSize="lg"
            placeholder={t('editModal.emailPlaceholder')}
            leftIcon={<EnvelopeIcon className="w-5 h-5" />}
            readOnly
            className="cursor-not-allowed"
            {...register('email')}
          />
        </FormField>

        <FormField label={t('editModal.phone')} error={errors.phone?.message} labelSize="lg">
          <Input
            type="tel"
            inputSize="lg"
            inputMode="tel"
            onKeyDown={onPhoneOnly}
            placeholder={t('editModal.phonePlaceholder')}
            leftIcon={<PhoneIcon className="w-5 h-5" />}
            {...register('phone')}
          />
        </FormField>
      </div>

      {/* Role */}
      <FormField label={t('editModal.role')} error={errors.role?.message} labelSize="lg">
        <Controller
          name="role"
          control={control}
          render={({ field }) => (
            <CustomDropdown
              options={roleOptions}
              value={field.value}
              onChange={field.onChange}
              placeholder={t('createModal.selectRole')}
              leftIcon={<BriefcaseIcon className="w-5 h-5" />}
              error={Boolean(errors.role)}
            />
          )}
        />
      </FormField>

      {/* Position (optional) */}
      <div>
        <label className="mb-1.5 block px-2">
          <span className="text-[16px] font-medium leading-[1.4] tracking-[0.3px] text-gray-800">
            {t('editModal.position')}{' '}
            <span className="text-[12px] font-normal text-gray-500">({t('common:optional')})</span>
          </span>
        </label>
        <Input
          type="text"
          inputSize="lg"
          placeholder={t('editModal.positionPlaceholder')}
          leftIcon={<IdBadgeIcon className="w-5 h-5" />}
          {...register('position')}
        />
      </div>

      {/* Department (optional) — UI only, not sent to API */}
      <div>
        <label className="mb-1.5 block px-2">
          <span className="text-[16px] font-medium leading-[1.4] tracking-[0.3px] text-gray-800">
            {t('editModal.department')}{' '}
            <span className="text-[12px] font-normal text-gray-500">({t('common:optional')})</span>
          </span>
        </label>
        <Input
          type="text"
          inputSize="lg"
          placeholder={t('editModal.departmentPlaceholder')}
          leftIcon={<DepartmentIcon className="w-5 h-5" />}
          {...register('department')}
        />
      </div>

      {/* Error alert */}
      {updateMutation.isError && <Alert variant="destructive">{t('editModal.updateError')}</Alert>}
    </GridModal>
  );
}
