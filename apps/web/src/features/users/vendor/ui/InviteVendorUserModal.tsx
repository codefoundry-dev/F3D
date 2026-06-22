import { useTranslation } from '@forethread/i18n';
import {
  GridModal,
  Input,
  FormField,
  Button,
  UserAlreadyExistsModal,
} from '@forethread/ui-components';
import EnvelopeIcon from '@forethread/ui-components/assets/icons/envelope-simple.svg?react';
import IdBadgeIcon from '@forethread/ui-components/assets/icons/id-badge.svg?react';
import NewUserIcon from '@forethread/ui-components/assets/icons/new-user.svg?react';
import UserOutlineIcon from '@forethread/ui-components/assets/icons/user-outline.svg?react';

import { useInviteVendorUserForm } from '../hooks/useInviteVendorUserForm';

interface InviteVendorUserModalProps {
  onClose: () => void;
}

export function InviteVendorUserModal({ onClose }: InviteVendorUserModalProps) {
  const { t } = useTranslation(['vendorUsers', 'common']);
  const { form, handleSubmit, inviteMutation, showUserExists, closeUserExists } =
    useInviteVendorUserForm(onClose);
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <>
      <GridModal
        onClose={onClose}
        icon={<NewUserIcon className="size-6 text-gray-700" />}
        title={t('inviteModal.title')}
        description={t('inviteModal.subtitle')}
        onSubmit={(e) => void handleSubmit(e)}
        actions={
          <>
            <Button type="submit" size="lg" isLoading={inviteMutation.isPending} className="w-full">
              {inviteMutation.isPending
                ? t('inviteModal.sending')
                : t('inviteModal.sendInvitation')}
            </Button>
            <Button variant="outline" size="lg" type="button" onClick={onClose} className="w-full">
              {t('common:cancel')}
            </Button>
          </>
        }
      >
        {/* Full Name */}
        <FormField label={t('inviteModal.fullName')} error={errors.name?.message} labelSize="lg">
          <Input
            type="text"
            inputSize="lg"
            placeholder={t('inviteModal.namePlaceholder')}
            leftIcon={<UserOutlineIcon className="w-5 h-5" />}
            {...register('name')}
          />
        </FormField>

        {/* Email */}
        <FormField label={t('inviteModal.email')} error={errors.email?.message} labelSize="lg">
          <Input
            type="email"
            inputSize="lg"
            placeholder={t('inviteModal.emailPlaceholder')}
            leftIcon={<EnvelopeIcon className="w-5 h-5" />}
            {...register('email')}
          />
        </FormField>

        {/* Position (optional) */}
        <FormField
          label={t('inviteModal.positionLabel')}
          optional
          error={errors.position?.message}
          labelSize="lg"
        >
          <Input
            type="text"
            inputSize="lg"
            placeholder={t('inviteModal.positionPlaceholder')}
            leftIcon={<IdBadgeIcon className="w-5 h-5" />}
            {...register('position')}
          />
        </FormField>
      </GridModal>

      {showUserExists && (
        <UserAlreadyExistsModal
          onClose={closeUserExists}
          onBack={onClose}
          title={t('vendorUsers:userAlreadyExists.title')}
          description={t('vendorUsers:userAlreadyExists.description')}
          buttonLabel={t('vendorUsers:userAlreadyExists.backToUsers')}
        />
      )}
    </>
  );
}
