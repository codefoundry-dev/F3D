import { useTranslation } from '@forethread/i18n';
import { CompanyType, UserRole } from '@forethread/shared-types/client';
import {
  Button,
  IconBadge,
  Input,
  FormField,
  CustomDropdown,
  Alert,
} from '@forethread/ui-components';
import BriefcaseIcon from '@forethread/ui-components/assets/icons/briefcase.svg?react';
import EnvelopeIcon from '@forethread/ui-components/assets/icons/envelope-simple.svg?react';
import IdBadgeIcon from '@forethread/ui-components/assets/icons/id-badge.svg?react';
import NewUserIcon from '@forethread/ui-components/assets/icons/new-user.svg?react';
import UserOutlineIcon from '@forethread/ui-components/assets/icons/user-outline.svg?react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';

import { CONTRACTOR_ROLE_OPTIONS } from '../../constants/roles';
import { useCreateUser } from '../../services/users.service';

interface UserDetailsStepProps {
  companyType: CompanyType;
  companyId: string;
  companyName: string;
  isNewlyCreatedCompany?: boolean;
  onSuccess: (email: string) => void;
  onCancel: () => void;
  onUserExists: () => void;
}

export function UserDetailsStep({
  companyType,
  companyId,
  companyName,
  isNewlyCreatedCompany,
  onSuccess,
  onCancel,
  onUserExists,
}: UserDetailsStepProps) {
  const { t } = useTranslation(['users', 'common', 'validation']);
  const createMutation = useCreateUser();

  const isContractor = companyType === CompanyType.CONTRACTOR;

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().min(1, t('validation:nameRequired')),
        email: z.string().email(t('validation:emailRequired')),
        role: isContractor
          ? z.string().min(1, t('validation:roleRequired'))
          : z.string().optional(),
        position: z.string().optional(),
      }),
    [t, isContractor],
  );

  type FormData = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      role: isContractor ? (isNewlyCreatedCompany ? UserRole.COMPANY_ADMIN : '') : UserRole.VENDOR,
    },
  });

  const roleOptions = useMemo(
    () =>
      CONTRACTOR_ROLE_OPTIONS.map((role) => ({
        value: role,
        label: String(t(`roles.${role}` as 'roles.COMPANY_ADMIN')),
      })),
    [t],
  );

  const onSubmit = (data: FormData) => {
    createMutation.mutate(
      {
        name: data.name,
        email: data.email,
        role: isContractor ? (data.role ?? '') : 'VENDOR',
        companyId,
        position: data.position ?? undefined,
      },
      {
        onSuccess: () => onSuccess(data.email),
        onError: (error) => {
          const apiError = error as { statusCode?: number };
          if (apiError.statusCode === 409) {
            onUserExists();
          }
        },
      },
    );
  };

  return (
    <div className="flex flex-col items-center text-center">
      <IconBadge icon={<NewUserIcon className="w-6 h-6 text-foreground" />} className="bg-muted" />

      <h2 className="text-lg font-semibold text-foreground mt-4">
        {t('createUserPage.userDetailsTitle')}
      </h2>
      <p className="text-sm text-muted-foreground mt-1">
        {t('createUserPage.userDetailsSubtitle')}
      </p>

      {/* Company info */}
      <div className="w-full mt-4 rounded-xl bg-muted border border-border px-4 py-3 text-left">
        <p className="text-xs text-muted-foreground">{t('createUserPage.company')}</p>
        <p className="text-sm font-medium text-foreground">{companyName}</p>
      </div>

      <form
        onSubmit={(e) => void handleSubmit(onSubmit)(e)}
        className="w-full mt-4 space-y-4 text-left"
        noValidate
      >
        <FormField
          label={t('createModal.representativeName')}
          error={errors.name?.message}
          required
        >
          <Input
            type="text"
            placeholder={t('createModal.namePlaceholder')}
            leftIcon={<UserOutlineIcon className="w-5 h-5" />}
            {...register('name')}
          />
        </FormField>

        <FormField
          label={t('createModal.representativeEmail')}
          error={errors.email?.message}
          required
        >
          <Input
            type="email"
            placeholder={t('createModal.emailPlaceholder')}
            leftIcon={<EnvelopeIcon className="w-5 h-5" />}
            {...register('email')}
          />
        </FormField>

        {isContractor && (
          <FormField label={t('createModal.role')} error={errors.role?.message} required>
            <Controller
              name="role"
              control={control}
              render={({ field }) => (
                <CustomDropdown
                  options={roleOptions}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder={t('createModal.selectRole')}
                  leftIcon={<IdBadgeIcon className="w-5 h-5" />}
                  error={!!errors.role}
                />
              )}
            />
          </FormField>
        )}

        <FormField label={t('createModal.position')}>
          <Input
            type="text"
            placeholder={t('createModal.positionPlaceholder')}
            leftIcon={<BriefcaseIcon className="w-5 h-5" />}
            {...register('position')}
          />
        </FormField>

        {createMutation.isError && (
          <Alert variant="destructive">
            {(createMutation.error as { response?: { data?: { error?: string } } })?.response?.data
              ?.error ?? t('createModal.createError')}
          </Alert>
        )}

        <div className="flex gap-3 pt-2">
          <Button variant="outline" type="button" onClick={onCancel} className="flex-1">
            {t('createUserPage.cancel')}
          </Button>
          <Button type="submit" isLoading={createMutation.isPending} className="flex-1">
            {createMutation.isPending
              ? t('createUserPage.sending')
              : t('createUserPage.sendInvitation')}
          </Button>
        </div>
      </form>
    </div>
  );
}
