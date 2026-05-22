import { useTranslation } from '@forethread/i18n';
import { CompanyType, VendorCategory } from '@forethread/shared-types/client';
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
} from '@forethread/ui-components';
import EnvelopeIcon from '@forethread/ui-components/assets/icons/envelope-simple.svg?react';
import InfoIcon from '@forethread/ui-components/assets/icons/info.svg?react';
import VendorsIcon from '@forethread/ui-components/assets/icons/vendors.svg?react';
import WrenchIcon from '@forethread/ui-components/assets/icons/wrench.svg?react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';

import { useCreateVendorCompany } from '../services/vendors.service';

const createVendorCompanySchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  companyEmail: z.string().email('Invalid email address'),
  specialisation: z.string().min(1, 'Specialisation is required'),
});

type CreateVendorCompanyFormValues = z.infer<typeof createVendorCompanySchema>;

interface CreateVendorCompanyModalProps {
  onClose: () => void;
  onSuccess: (
    companyId: string,
    companyName: string,
    companyEmail: string,
    alreadyExisted: boolean,
  ) => void;
}

export function CreateVendorCompanyModal({ onClose, onSuccess }: CreateVendorCompanyModalProps) {
  const { t } = useTranslation(['vendors', 'common']);
  const createMutation = useCreateVendorCompany();
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateVendorCompanyFormValues>({
    resolver: zodResolver(createVendorCompanySchema),
  });

  const specialisationOptions = useMemo(
    () =>
      Object.values(VendorCategory).map((cat) => ({
        value: cat,
        label: t(`vendorCategories.${cat}` as `vendorCategories.CONCRETE_MASONRY`),
      })),
    [t],
  );

  const onSubmit = handleSubmit((data) => {
    setErrorKey(null);
    createMutation.mutate(
      {
        type: CompanyType.VENDOR,
        legalName: data.companyName,
        contactEmail: data.companyEmail,
        specialisations: [data.specialisation],
      },
      {
        onSuccess: (response) => {
          onSuccess(response.id, response.legalName, data.companyEmail, !!response.alreadyExisted);
        },
        onError: () => {
          setErrorKey('createError');
        },
      },
    );
  });

  return (
    <Modal onClose={onClose} maxWidth="max-w-[560px]">
      <ModalBody>
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-5" noValidate>
          {/* Header */}
          <div className="flex flex-col items-center text-center mb-2">
            <div className="w-full flex justify-between items-start">
              <div className="flex-1" />
              <IconBadge icon={<VendorsIcon className="w-6 h-6 text-foreground" />} />
              <div className="flex-1 flex justify-end">
                <ModalCloseButton onClose={onClose} />
              </div>
            </div>
            <h2 className="text-2xl font-normal leading-[140%] text-foreground mt-4">
              {t('createCompanyModal.title')}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">{t('createCompanyModal.subtitle')}</p>
          </div>

          {/* Error alert */}
          {errorKey && (
            <Alert variant="destructive" icon={<InfoIcon className="w-5 h-5" />}>
              {t(`createCompanyModal.${errorKey}` as 'createCompanyModal.createError')}
            </Alert>
          )}

          {/* Company Name */}
          <FormField
            label={t('createCompanyModal.companyName')}
            error={errors.companyName?.message}
          >
            <Input
              type="text"
              placeholder={t('createCompanyModal.companyNamePlaceholder')}
              {...register('companyName')}
            />
          </FormField>

          {/* Company Email */}
          <FormField
            label={t('createCompanyModal.companyEmail')}
            error={errors.companyEmail?.message}
          >
            <Input
              type="email"
              placeholder={t('createCompanyModal.companyEmailPlaceholder')}
              leftIcon={<EnvelopeIcon className="w-5 h-5" />}
              {...register('companyEmail')}
            />
          </FormField>

          {/* Specialisation */}
          <FormField
            label={t('createCompanyModal.specialisation')}
            error={errors.specialisation?.message}
          >
            <Controller
              name="specialisation"
              control={control}
              render={({ field }) => (
                <CustomDropdown
                  options={specialisationOptions}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder={t('createCompanyModal.specialisationPlaceholder')}
                  leftIcon={<WrenchIcon className="w-5 h-5" />}
                  searchable
                  error={Boolean(errors.specialisation)}
                />
              )}
            />
          </FormField>

          {/* Actions */}
          <div className="flex flex-col gap-3 pt-2">
            <Button type="submit" isLoading={createMutation.isPending} className="w-full">
              {createMutation.isPending
                ? t('createCompanyModal.creating')
                : t('createCompanyModal.createCompany')}
            </Button>
            <Button variant="outline" type="button" onClick={onClose} className="w-full">
              {t('common:cancel')}
            </Button>
          </div>
        </form>
      </ModalBody>
    </Modal>
  );
}
