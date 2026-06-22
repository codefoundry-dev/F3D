import { useTranslation } from '@forethread/i18n';
import {
  GridModal,
  Input,
  FormField,
  Button,
  Alert,
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
      <GridModal
        onClose={onClose}
        icon={<NewUserIcon className="size-6 text-gray-700" />}
        title={t('createModal.title')}
        description={t('createModal.subtitle')}
        onSubmit={(e) => void handleSubmit(e)}
        actions={
          <>
            <Button type="submit" size="lg" isLoading={createMutation.isPending} className="w-full">
              {createMutation.isPending
                ? t('createModal.creating')
                : t('createModal.sendInvitation')}
            </Button>
            <Button variant="outline" size="lg" type="button" onClick={onClose} className="w-full">
              {t('common:cancel')}
            </Button>
          </>
        }
      >
        {/* Error alert */}
        {createMutation.isError && (
          <Alert variant="destructive" icon={<InfoIcon className="w-5 h-5" />}>
            {isEmailInUseError ? t('createModal.emailInUse') : t('createModal.createError')}
          </Alert>
        )}

        {/* Full Name */}
        <FormField label={t('createModal.fullName')} error={errors.name?.message} labelSize="lg">
          <Input
            type="text"
            inputSize="lg"
            placeholder={t('createModal.namePlaceholder')}
            leftIcon={<UserOutlineIcon className="w-5 h-5" />}
            {...register('name')}
          />
        </FormField>

        {/* Email */}
        <FormField label={t('createModal.email')} error={errors.email?.message} labelSize="lg">
          <Input
            type="email"
            inputSize="lg"
            placeholder={t('createModal.emailPlaceholder')}
            leftIcon={<EnvelopeIcon className="w-5 h-5" />}
            {...register('email')}
          />
        </FormField>

        {/* Role */}
        <FormField label={t('createModal.role')} error={errors.role?.message} labelSize="lg">
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
        <FormField
          label={t('createModal.position')}
          optional
          error={errors.position?.message}
          labelSize="lg"
        >
          <Input
            type="text"
            inputSize="lg"
            placeholder={t('createModal.positionPlaceholder')}
            leftIcon={<IdBadgeIcon className="w-5 h-5" />}
            {...register('position')}
          />
        </FormField>
      </GridModal>

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
