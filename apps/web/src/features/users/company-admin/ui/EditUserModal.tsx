import { useTranslation } from '@forethread/i18n';
import {
  Modal,
  ModalBody,
  ModalCloseButton,
  Input,
  FormField,
  Button,
  Alert,
  IconBadge,
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

  return (
    <Modal onClose={onClose} maxWidth="max-w-[560px]">
      <ModalBody>
        {isLoadingUser ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="md" />
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5" noValidate>
            {/* Header */}
            <div className="flex flex-col items-center text-center mb-2">
              <div className="w-full flex justify-between items-start">
                <div className="flex-1" />
                <IconBadge icon={<EditIcon className="w-6 h-6 text-foreground" />} />
                <div className="flex-1 flex justify-end">
                  <ModalCloseButton onClose={onClose} />
                </div>
              </div>
              <h2 className="text-2xl font-semibold leading-[140%] text-foreground mt-4">
                {t('editModal.title')}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">{t('editModal.subtitle')}</p>
            </div>

            {/* Full Name */}
            <FormField label={t('editModal.fullName')} error={errors.name?.message}>
              <Input
                type="text"
                placeholder={t('editModal.namePlaceholder')}
                leftIcon={<UserOutlineIcon className="w-5 h-5" />}
                {...register('name')}
              />
            </FormField>

            {/* Email + Phone */}
            <div className="grid grid-cols-2 gap-3">
              <FormField label={t('editModal.email')} error={errors.email?.message}>
                <Input
                  type="email"
                  placeholder={t('editModal.emailPlaceholder')}
                  leftIcon={<EnvelopeIcon className="w-5 h-5" />}
                  readOnly
                  className="cursor-not-allowed"
                  {...register('email')}
                />
              </FormField>

              <FormField label={t('editModal.phone')} error={errors.phone?.message}>
                <Input
                  type="tel"
                  inputMode="tel"
                  onKeyDown={onPhoneOnly}
                  placeholder={t('editModal.phonePlaceholder')}
                  leftIcon={<PhoneIcon className="w-5 h-5" />}
                  {...register('phone')}
                />
              </FormField>
            </div>

            {/* Role */}
            <FormField label={t('editModal.role')} error={errors.role?.message}>
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
              <label className="block mb-1.5">
                <span className="text-sm font-medium text-card-foreground">
                  {t('editModal.position')}&nbsp;
                  <span className="text-muted-foreground font-normal">
                    ({t('common:optional')})
                  </span>
                </span>
              </label>
              <Input
                type="text"
                placeholder={t('editModal.positionPlaceholder')}
                leftIcon={<IdBadgeIcon className="w-5 h-5" />}
                {...register('position')}
              />
            </div>

            {/* Department (optional) — UI only, not sent to API */}
            <div>
              <label className="block mb-1.5">
                <span className="text-sm font-medium text-card-foreground">
                  {t('editModal.department')}&nbsp;
                  <span className="text-muted-foreground font-normal">
                    ({t('common:optional')})
                  </span>
                </span>
              </label>
              <Input
                type="text"
                placeholder={t('editModal.departmentPlaceholder')}
                leftIcon={<DepartmentIcon className="w-5 h-5" />}
                {...register('department')}
              />
            </div>

            {/* Error alert */}
            {updateMutation.isError && (
              <Alert variant="destructive">{t('editModal.updateError')}</Alert>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-3 pt-2">
              <Button type="submit" isLoading={updateMutation.isPending} className="w-full">
                {updateMutation.isPending
                  ? t('editModal.submitting')
                  : t('editModal.submitChanges')}
              </Button>
              <Button variant="outline" type="button" onClick={onClose} className="w-full">
                {t('common:cancel')}
              </Button>
            </div>
          </form>
        )}
      </ModalBody>
    </Modal>
  );
}
