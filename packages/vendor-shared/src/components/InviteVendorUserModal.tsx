import { useTranslation } from '@forethread/i18n';
import {
  GridModal,
  Input,
  FormField,
  Button,
  Alert,
  UserAlreadyExistsModal,
} from '@forethread/ui-components';
import EnvelopeIcon from '@forethread/ui-components/assets/icons/envelope-simple.svg?react';
import IdBadgeIcon from '@forethread/ui-components/assets/icons/id-badge.svg?react';
import InfoIcon from '@forethread/ui-components/assets/icons/info.svg?react';
import NewUserIcon from '@forethread/ui-components/assets/icons/new-user.svg?react';
import UserOutlineIcon from '@forethread/ui-components/assets/icons/user-outline.svg?react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useInviteVendorUser } from '../services/vendors.service';

const inviteVendorUserSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  email: z.string().email('Invalid email address'),
  position: z.string().max(255).optional(),
});

type InviteVendorUserFormValues = z.infer<typeof inviteVendorUserSchema>;

interface InviteVendorUserModalProps {
  /** The vendor company the invited user will belong to */
  vendorId: string;
  onClose: () => void;
  onSuccess: (email: string) => void;
}

/**
 * Invites a user to an existing vendor company via the company-scoped
 * POST /vendors/:id/users/invite. Used from VendorProfilePage by both the
 * vendor's own admins and buyers — unlike InviteVendorModal, which drives the
 * buyer-only invite-a-vendor-company flow (FOR-289).
 */
export function InviteVendorUserModal({
  vendorId,
  onClose,
  onSuccess,
}: InviteVendorUserModalProps) {
  const { t } = useTranslation(['vendors', 'common']);
  const inviteMutation = useInviteVendorUser();
  const [showUserExists, setShowUserExists] = useState(false);
  const [showError, setShowError] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<InviteVendorUserFormValues>({
    resolver: zodResolver(inviteVendorUserSchema),
  });

  const onSubmit = handleSubmit((data) => {
    setShowError(false);
    inviteMutation.mutate(
      {
        vendorId,
        input: {
          name: data.name,
          email: data.email,
          // Optional server-side too — omit rather than send an empty string
          position: data.position?.trim() ? data.position.trim() : undefined,
        },
      },
      {
        onSuccess: () => {
          onClose();
          onSuccess(data.email);
        },
        onError: (error) => {
          const apiError = error as { statusCode?: number };
          if (apiError.statusCode === 409) setShowUserExists(true);
          else setShowError(true);
        },
      },
    );
  });

  return (
    <>
      <GridModal
        onClose={onClose}
        maxWidth="max-w-[560px]"
        icon={<NewUserIcon className="size-6 text-gray-700" />}
        title={t('userInvite.title')}
        description={t('userInvite.subtitle')}
        onSubmit={(e) => void onSubmit(e)}
        actions={
          <>
            <Button type="submit" size="lg" isLoading={inviteMutation.isPending} className="w-full">
              {inviteMutation.isPending ? t('userInvite.sending') : t('userInvite.sendInvitation')}
            </Button>
            <Button variant="outline" size="lg" type="button" onClick={onClose} className="w-full">
              {t('common:cancel')}
            </Button>
          </>
        }
      >
        {showError && (
          <Alert variant="destructive" icon={<InfoIcon className="w-5 h-5" />}>
            {t('userInvite.error')}
          </Alert>
        )}

        {/* Full name */}
        <FormField label={t('userInvite.name')} error={errors.name?.message}>
          <Input
            type="text"
            placeholder={t('userInvite.namePlaceholder')}
            leftIcon={<UserOutlineIcon className="w-5 h-5" />}
            {...register('name')}
          />
        </FormField>

        {/* Email */}
        <FormField label={t('userInvite.email')} error={errors.email?.message}>
          <Input
            type="email"
            placeholder={t('userInvite.emailPlaceholder')}
            leftIcon={<EnvelopeIcon className="w-5 h-5" />}
            {...register('email')}
          />
        </FormField>

        {/* Position (optional) */}
        <FormField
          label={`${t('userInvite.position')} ${t('userInvite.positionOptional')}`}
          error={errors.position?.message}
        >
          <Input
            type="text"
            placeholder={t('userInvite.positionPlaceholder')}
            leftIcon={<IdBadgeIcon className="w-5 h-5" />}
            {...register('position')}
          />
        </FormField>
      </GridModal>

      {showUserExists && (
        <UserAlreadyExistsModal
          onClose={() => setShowUserExists(false)}
          onBack={onClose}
          title={t('common:userAlreadyExists.title')}
          description={t('common:userAlreadyExists.description')}
          buttonLabel={t('vendors:inviteSuccess.backToVendors')}
        />
      )}
    </>
  );
}
