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
  UserAlreadyExistsModal,
} from '@forethread/ui-components';
import BriefcaseIcon from '@forethread/ui-components/assets/icons/briefcase.svg?react';
import EnvelopeIcon from '@forethread/ui-components/assets/icons/envelope-simple.svg?react';
import IdBadgeIcon from '@forethread/ui-components/assets/icons/id-badge.svg?react';
import InfoIcon from '@forethread/ui-components/assets/icons/info.svg?react';
import NewUserIcon from '@forethread/ui-components/assets/icons/new-user.svg?react';
import UserOutlineIcon from '@forethread/ui-components/assets/icons/user-outline.svg?react';
import { Controller } from 'react-hook-form';

import { useCreateUserForm } from '../hooks/useCreateUserForm';
import { useRoleOptions } from '../hooks/useRoleOptions';

interface CreateUserModalProps {
  onClose: () => void;
}

export function CreateUserModal({ onClose }: CreateUserModalProps) {
  const { t } = useTranslation(['users', 'common']);
  const roleOptions = useRoleOptions();
  const { form, handleSubmit, createMutation, isEmailInUseError, showUserExists, closeUserExists } =
    useCreateUserForm(onClose);
  const {
    register,
    control,
    formState: { errors },
  } = form;

  return (
    <>
      <Modal onClose={onClose} maxWidth="max-w-[560px]">
        <ModalBody>
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5" noValidate>
            {/* Header */}
            <div className="flex flex-col items-center text-center mb-2">
              <div className="w-full flex justify-between items-start">
                <div className="flex-1" />
                <IconBadge icon={<NewUserIcon className="w-6 h-6 text-foreground" />} />
                <div className="flex-1 flex justify-end">
                  <ModalCloseButton onClose={onClose} />
                </div>
              </div>
              <h2 className="text-2xl font-normal leading-[140%] text-foreground mt-4">
                {t('createModal.title')}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">{t('createModal.subtitle')}</p>
            </div>
            {/* Error alert */}
            {createMutation.isError && (
              <Alert variant="destructive" icon={<InfoIcon className="w-5 h-5" />}>
                {isEmailInUseError ? t('createModal.emailInUse') : t('createModal.createError')}
              </Alert>
            )}

            {/* Full Name */}
            <FormField label={t('createModal.fullName')} error={errors.name?.message}>
              <Input
                type="text"
                placeholder={t('createModal.namePlaceholder')}
                leftIcon={<UserOutlineIcon className="w-5 h-5" />}
                {...register('name')}
              />
            </FormField>

            {/* Email */}
            <FormField label={t('createModal.email')} error={errors.email?.message}>
              <Input
                type="email"
                placeholder={t('createModal.emailPlaceholder')}
                leftIcon={<EnvelopeIcon className="w-5 h-5" />}
                {...register('email')}
              />
            </FormField>

            {/* Role */}
            <FormField label={t('createModal.role')} error={errors.role?.message}>
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

            {/* Position */}
            <FormField label={t('createModal.position')} error={errors.position?.message}>
              <Input
                type="text"
                placeholder={t('createModal.positionPlaceholder')}
                leftIcon={<IdBadgeIcon className="w-5 h-5" />}
                {...register('position')}
              />
            </FormField>
            {/* Actions */}
            <div className="flex flex-col gap-3 pt-2">
              <Button type="submit" isLoading={createMutation.isPending} className="w-full">
                {createMutation.isPending
                  ? t('createModal.creating')
                  : t('createModal.sendInvitation')}
              </Button>
              <Button variant="outline" type="button" onClick={onClose} className="w-full">
                {t('common:cancel')}
              </Button>
            </div>
          </form>
        </ModalBody>
      </Modal>

      {showUserExists && (
        <UserAlreadyExistsModal
          onClose={closeUserExists}
          onBack={onClose}
          title={t('common:userAlreadyExists.title')}
          description={t('common:userAlreadyExists.description')}
          buttonLabel={t('common:userAlreadyExists.backButton')}
        />
      )}
    </>
  );
}
