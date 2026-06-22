import { useTranslation } from '@forethread/i18n';
import {
  GridModal,
  Input,
  FormField,
  Button,
  Alert,
  CustomDropdown,
  onPhoneOnly,
} from '@forethread/ui-components';
import BriefcaseIcon from '@forethread/ui-components/assets/icons/briefcase.svg?react';
import DepartmentIcon from '@forethread/ui-components/assets/icons/department.svg?react';
import EditIcon from '@forethread/ui-components/assets/icons/edit-without-line.svg?react';
import IdBadgeIcon from '@forethread/ui-components/assets/icons/id-badge.svg?react';
import PhoneIcon from '@forethread/ui-components/assets/icons/phone.svg?react';
import UserOutlineIcon from '@forethread/ui-components/assets/icons/user-outline.svg?react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';

import { useProfile, useUpdateProfile } from '../services/profile.service';

export interface EditProfileModalProps {
  onClose: () => void;
}

export function EditProfileModal({ onClose }: EditProfileModalProps) {
  const { t } = useTranslation(['profile', 'common', 'validation']);
  const { data: profile } = useProfile();
  const updateMutation = useUpdateProfile();

  const schema = z.object({
    name: z.string().min(1, t('validation:nameRequired')),
    phone: z.string().optional(),
    workStatus: z.string().optional(),
    position: z.string().optional(),
    department: z.string().optional(),
  });

  type FormData = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      phone: '',
      workStatus: '',
      position: '',
      department: '',
    },
  });

  useEffect(() => {
    if (profile) {
      reset({
        name: profile.name,
        phone: profile.phone ?? '',
        workStatus: profile.workStatus ?? '',
        position: profile.position ?? '',
        department: profile.department ?? '',
      });
    }
  }, [profile, reset]);

  const workStatusOptions = useMemo(
    () => [
      { value: 'available', label: t('workStatusOptions.available') },
      { value: 'unavailable', label: t('workStatusOptions.unavailable') },
      { value: 'onLeave', label: t('workStatusOptions.onLeave') },
    ],
    [t],
  );

  const onSubmit = (data: FormData) => {
    updateMutation.mutate(
      {
        name: data.name,
        phone: data.phone ?? undefined,
        position: data.position ?? undefined,
        workStatus: data.workStatus ?? undefined,
        department: data.department ?? undefined,
      },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <GridModal
      onClose={onClose}
      maxWidth="max-w-[560px]"
      icon={<EditIcon className="size-6 text-gray-700" />}
      title={t('editModal.title')}
      description={t('editModal.subtitle')}
      onSubmit={(e) => void handleSubmit(onSubmit)(e)}
      actionsClassName="gap-4"
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
      <FormField label={t('editModal.fullName')} error={errors.name?.message} required>
        <Input
          type="text"
          placeholder={t('editModal.namePlaceholder')}
          leftIcon={<UserOutlineIcon className="w-5 h-5" />}
          {...register('name')}
        />
      </FormField>

      {/* Phone */}
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

      {/* Work Status */}
      <FormField label={t('editModal.workStatus')}>
        <Controller
          name="workStatus"
          control={control}
          render={({ field }) => (
            <CustomDropdown
              options={workStatusOptions}
              value={field.value ?? ''}
              onChange={field.onChange}
              placeholder={t('editModal.workStatusPlaceholder')}
              leftIcon={<BriefcaseIcon className="w-5 h-5" />}
            />
          )}
        />
      </FormField>

      {/* Position (optional) */}
      <div>
        <label className="block mb-1.5">
          <span className="text-sm font-medium text-card-foreground">
            {t('editModal.position')}&nbsp;
            <span className="text-muted-foreground font-normal">({t('common:optional')})</span>
          </span>
        </label>
        <Input
          type="text"
          placeholder={t('editModal.positionPlaceholder')}
          leftIcon={<IdBadgeIcon className="w-5 h-5" />}
          {...register('position')}
        />
      </div>

      {/* Department */}
      <div>
        <label className="block mb-1.5">
          <span className="text-sm font-medium text-card-foreground">
            {t('editModal.department')}
          </span>
        </label>
        <Input
          type="text"
          placeholder={t('editModal.departmentPlaceholder')}
          leftIcon={<DepartmentIcon className="w-5 h-5" />}
          {...register('department')}
        />
      </div>

      {/* Error */}
      {updateMutation.isError && <Alert variant="destructive">{t('editModal.updateError')}</Alert>}
    </GridModal>
  );
}
